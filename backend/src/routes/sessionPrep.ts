import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

// Derived session-prep view: groups existing data into the buckets a GM
// actually wants before a session. No new state is stored here.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;

    const [entities, relationships, generatedPrompts, openQuestions] = await Promise.all([
      prisma.entity.findMany({ where: { campaignId } }),
      prisma.relationship.findMany({ where: { campaignId } }),
      prisma.generatedPrompt.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.openQuestion.findMany({
        where: { campaignId, resolved: false },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const entityById = new Map(entities.map((e) => [e.id, e]));

    const enrich = (r: (typeof relationships)[number]) => ({
      ...r,
      sourceEntity: entityById.get(r.sourceEntityId) ?? null,
      targetEntity: entityById.get(r.targetEntityId) ?? null,
    });

    const criticalConflicts = relationships
      .filter((r) => ['hates', 'hunts', 'betrayed_by'].includes(r.type) || r.status === 'escalating')
      .map(enrich);

    const secretRelationships = relationships
      .filter((r) => r.visibility === 'gm_only' || r.status === 'secret')
      .map(enrich);

    const openDebts = relationships.filter((r) => r.type === 'owes').map(enrich);

    const unstableAlliances = relationships
      .filter((r) => r.type === 'allied_with' && (r.status === 'unstable' || r.status === 'escalating'))
      .map(enrich);

    const possibleReveals = entities.filter(
      (e) => e.type === 'secret' || e.visibility === 'gm_only',
    );

    const sessionHooks = generatedPrompts
      .filter((p) => p.type === 'session_hook')
      .slice(0, 5);

    res.json({
      criticalConflicts,
      secretRelationships,
      openDebts,
      unstableAlliances,
      possibleReveals,
      sessionHooks,
      allPrompts: generatedPrompts,
      openQuestions,
    });
  }),
);

export default router;
