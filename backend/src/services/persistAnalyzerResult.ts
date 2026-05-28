import { PrismaClient } from '@prisma/client';
import { AnalyzerResult } from '../analyzers/types';

// Idempotently merges an analyzer result into a campaign. Entities are matched
// by case-insensitive name within the campaign (Prisma unique constraint
// enforces this). Relationships are matched by (source, target, type). Open
// questions are deduped by question text.

export async function persistAnalyzerResult(
  prisma: PrismaClient,
  campaignId: string,
  result: AnalyzerResult,
) {
  const nameToId = new Map<string, string>();

  const existing = await prisma.entity.findMany({
    where: { campaignId },
    select: { id: true, name: true },
  });
  for (const e of existing) nameToId.set(e.name.toLowerCase(), e.id);

  for (const ent of result.entities) {
    const key = ent.name.toLowerCase();
    const data = {
      type: ent.type,
      description: ent.description ?? null,
      confidenceScore: ent.confidenceScore,
      visibility: ent.visibility ?? 'public',
      status: ent.status ?? 'active',
      importance: ent.importance ?? 'medium',
      sourceExcerpt: ent.sourceExcerpt ?? null,
      imagePrompt: ent.imagePrompt ?? null,
      isUncertain: ent.isUncertain ?? false,
    } as const;

    const saved = await prisma.entity.upsert({
      where: { campaignId_name: { campaignId, name: ent.name } },
      create: {
        campaignId,
        name: ent.name,
        ...data,
      },
      update: {
        description: data.description ?? undefined,
        confidenceScore: Math.max(0, Math.min(1, data.confidenceScore)),
        visibility: data.visibility,
        status: data.status,
        importance: data.importance,
        sourceExcerpt: data.sourceExcerpt ?? undefined,
        imagePrompt: data.imagePrompt ?? undefined,
        isUncertain: data.isUncertain,
        // Don't downgrade an already-typed entity back to "unknown".
        type: ent.type === 'unknown' ? undefined : data.type,
      },
    });
    nameToId.set(key, saved.id);
  }

  for (const rel of result.relationships) {
    const sId = await ensureEntity(prisma, campaignId, rel.sourceName, nameToId);
    const tId = await ensureEntity(prisma, campaignId, rel.targetName, nameToId);
    if (!sId || !tId || sId === tId) continue;

    const existingRel = await prisma.relationship.findFirst({
      where: {
        campaignId,
        sourceEntityId: sId,
        targetEntityId: tId,
        type: rel.type,
      },
    });

    const data = {
      description: rel.description ?? null,
      intensity: rel.intensity ?? 3,
      confidenceScore: rel.confidenceScore,
      visibility: rel.visibility ?? 'public',
      status: rel.status ?? 'stable',
      sourceExcerpt: rel.sourceExcerpt ?? null,
      isUncertain: rel.isUncertain ?? false,
    };

    if (existingRel) {
      await prisma.relationship.update({
        where: { id: existingRel.id },
        data: {
          ...data,
          confidenceScore: Math.max(existingRel.confidenceScore, data.confidenceScore),
        },
      });
    } else {
      await prisma.relationship.create({
        data: {
          campaignId,
          sourceEntityId: sId,
          targetEntityId: tId,
          type: rel.type,
          ...data,
        },
      });
    }
  }

  for (const p of result.generatedPrompts) {
    const existingPrompt = await prisma.generatedPrompt.findFirst({
      where: { campaignId, title: p.title },
    });
    if (existingPrompt) continue;

    const relatedEntityIds: string[] = [];
    for (const name of p.relatedEntityNames ?? []) {
      const id = nameToId.get(name.toLowerCase());
      if (id) relatedEntityIds.push(id);
    }

    await prisma.generatedPrompt.create({
      data: {
        campaignId,
        title: p.title,
        description: p.description,
        type: p.type,
        relatedEntityIds,
        relatedRelationshipIds: [],
      },
    });
  }

  for (const q of result.openQuestions ?? []) {
    const existingQ = await prisma.openQuestion.findFirst({
      where: { campaignId, question: q.question },
    });
    if (existingQ) continue;

    const relatedEntityIds: string[] = [];
    for (const name of q.relatedEntityNames ?? []) {
      const id = nameToId.get(name.toLowerCase());
      if (id) relatedEntityIds.push(id);
    }

    await prisma.openQuestion.create({
      data: {
        campaignId,
        question: q.question,
        relatedEntityIds,
      },
    });
  }
}

async function ensureEntity(
  prisma: PrismaClient,
  campaignId: string,
  name: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const created = await prisma.entity.upsert({
    where: { campaignId_name: { campaignId, name: trimmed } },
    create: {
      campaignId,
      name: trimmed,
      type: 'unknown',
      confidenceScore: 0.4,
    },
    update: {},
  });
  cache.set(key, created.id);
  return created.id;
}
