import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const ENTITY_TYPES = [
  'player_character', 'npc', 'faction', 'location', 'item', 'secret', 'event', 'unknown',
] as const;
const RELATIONSHIP_TYPES = [
  'allied_with', 'hates', 'loves', 'owes', 'manipulates', 'protects', 'hunts',
  'works_for', 'betrayed_by', 'related_to', 'controls', 'knows_secret_of',
  'competes_with', 'located_in', 'owns', 'involved_in', 'unknown_connection',
] as const;
const VISIBILITY = ['public', 'gm_only'] as const;
const ENTITY_STATUS = ['active', 'dead', 'missing', 'destroyed', 'unknown'] as const;
const REL_STATUS = ['stable', 'unstable', 'escalating', 'broken', 'secret'] as const;
const IMPORTANCE = ['low', 'medium', 'high', 'critical'] as const;
const SOURCE_TYPES = ['lore', 'session_notes', 'adventure', 'character_backstory', 'other'] as const;
const PROMPT_TYPES = [
  'conflict', 'reveal', 'debt', 'betrayal', 'alliance', 'mystery', 'session_hook',
] as const;

// Export — full snapshot of one campaign
export const exportRouter = Router({ mergeParams: true });

exportRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        sourceTexts: true,
        entities: { include: { tags: { include: { tag: true } } } },
        relationships: true,
        generatedPrompts: true,
        tags: true,
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaign.id}.json"`);
    res.json({ version: 1, campaign });
  }),
);

// Import — accepts the same shape that export emits
export const importRouter = Router();

const importSchema = z.object({
  version: z.number().optional(),
  campaign: z.object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    system: z.string().optional().nullable(),
    tone: z.string().optional().nullable(),
    sourceTexts: z
      .array(
        z.object({
          title: z.string().optional().nullable(),
          rawText: z.string(),
          sourceType: z.enum(SOURCE_TYPES).default('other'),
        }),
      )
      .default([]),
    entities: z
      .array(
        z.object({
          name: z.string().min(1),
          type: z.enum(ENTITY_TYPES).default('unknown'),
          description: z.string().optional().nullable(),
          confidenceScore: z.number().min(0).max(1).default(1),
          visibility: z.enum(VISIBILITY).default('public'),
          status: z.enum(ENTITY_STATUS).default('active'),
          importance: z.enum(IMPORTANCE).default('medium'),
          sourceExcerpt: z.string().optional().nullable(),
        }),
      )
      .default([]),
    relationships: z
      .array(
        z.object({
          sourceName: z.string().optional(),
          targetName: z.string().optional(),
          // Either name-based or id-based pointers from a paired export
          sourceEntityId: z.string().optional(),
          targetEntityId: z.string().optional(),
          type: z.enum(RELATIONSHIP_TYPES).default('unknown_connection'),
          description: z.string().optional().nullable(),
          intensity: z.number().int().min(1).max(5).default(3),
          visibility: z.enum(VISIBILITY).default('public'),
          status: z.enum(REL_STATUS).default('stable'),
          confidenceScore: z.number().min(0).max(1).default(1),
          sourceExcerpt: z.string().optional().nullable(),
        }),
      )
      .default([]),
    generatedPrompts: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
          type: z.enum(PROMPT_TYPES).default('session_hook'),
        }),
      )
      .default([]),
  }),
});

importRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = importSchema.parse(req.body);
    const c = parsed.campaign;

    const created = await prisma.campaign.create({
      data: {
        name: c.name,
        description: c.description ?? null,
        system: c.system ?? null,
        tone: c.tone ?? null,
      },
    });

    // Source texts
    if (c.sourceTexts.length) {
      await prisma.campaignSourceText.createMany({
        data: c.sourceTexts.map((s) => ({
          campaignId: created.id,
          title: s.title ?? null,
          rawText: s.rawText,
          sourceType: s.sourceType,
        })),
      });
    }

    // Entities — keep name -> new id map for relationship resolution
    const nameToId = new Map<string, string>();
    const oldIdToNewId = new Map<string, string>();
    for (const e of c.entities) {
      const ent = await prisma.entity.create({
        data: {
          campaignId: created.id,
          name: e.name,
          type: e.type,
          description: e.description ?? null,
          confidenceScore: e.confidenceScore,
          visibility: e.visibility,
          status: e.status,
          importance: e.importance,
          sourceExcerpt: e.sourceExcerpt ?? null,
        },
      });
      nameToId.set(e.name.toLowerCase(), ent.id);
      // Old ids may be present if export shape included them
      const anyE = e as unknown as { id?: string };
      if (anyE.id) oldIdToNewId.set(anyE.id, ent.id);
    }

    // Relationships
    for (const r of c.relationships) {
      let srcId = r.sourceEntityId ? oldIdToNewId.get(r.sourceEntityId) : undefined;
      let tgtId = r.targetEntityId ? oldIdToNewId.get(r.targetEntityId) : undefined;
      if (!srcId && r.sourceName) srcId = nameToId.get(r.sourceName.toLowerCase());
      if (!tgtId && r.targetName) tgtId = nameToId.get(r.targetName.toLowerCase());
      if (!srcId || !tgtId || srcId === tgtId) continue;

      await prisma.relationship.create({
        data: {
          campaignId: created.id,
          sourceEntityId: srcId,
          targetEntityId: tgtId,
          type: r.type,
          description: r.description ?? null,
          intensity: r.intensity,
          visibility: r.visibility,
          status: r.status,
          confidenceScore: r.confidenceScore,
          sourceExcerpt: r.sourceExcerpt ?? null,
        },
      });
    }

    if (c.generatedPrompts.length) {
      await prisma.generatedPrompt.createMany({
        data: c.generatedPrompts.map((p) => ({
          campaignId: created.id,
          title: p.title,
          description: p.description,
          type: p.type,
          relatedEntityIds: [],
          relatedRelationshipIds: [],
        })),
      });
    }

    res.status(201).json({ id: created.id });
  }),
);
