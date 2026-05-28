import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const RELATIONSHIP_TYPES = [
  'allied_with', 'hates', 'loves', 'owes', 'manipulates', 'protects', 'hunts',
  'works_for', 'betrayed_by', 'related_to', 'controls', 'knows_secret_of',
  'competes_with', 'located_in', 'owns', 'involved_in', 'unknown_connection',
] as const;
const VISIBILITY = ['public', 'gm_only'] as const;
const STATUS = ['stable', 'unstable', 'escalating', 'broken', 'secret'] as const;

const createSchema = z.object({
  sourceEntityId: z.string().min(1),
  targetEntityId: z.string().min(1),
  type: z.enum(RELATIONSHIP_TYPES).default('unknown_connection'),
  description: z.string().optional().nullable(),
  intensity: z.number().int().min(1).max(5).default(3),
  visibility: z.enum(VISIBILITY).default('public'),
  status: z.enum(STATUS).default('stable'),
  confidenceScore: z.number().min(0).max(1).default(1),
  sourceExcerpt: z.string().optional().nullable(),
  isUncertain: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

// Mounted on /api/campaigns/:id/relationships
export const campaignRelationships = Router({ mergeParams: true });

campaignRelationships.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.relationship.findMany({
      where: { campaignId: req.params.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(items);
  }),
);

campaignRelationships.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    if (data.sourceEntityId === data.targetEntityId) {
      return res.status(400).json({ error: 'sourceEntityId must differ from targetEntityId' });
    }
    const created = await prisma.relationship.create({
      data: { ...data, campaignId: req.params.id },
    });
    res.status(201).json(created);
  }),
);

// Mounted on /api/relationships/:relationshipId
export const relationshipsDirect = Router();

relationshipsDirect.put(
  '/:relationshipId',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const updated = await prisma.relationship.update({
      where: { id: req.params.relationshipId },
      data,
    });
    res.json(updated);
  }),
);

relationshipsDirect.delete(
  '/:relationshipId',
  asyncHandler(async (req, res) => {
    await prisma.relationship.delete({ where: { id: req.params.relationshipId } });
    res.status(204).end();
  }),
);
