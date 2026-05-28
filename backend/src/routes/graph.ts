import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

// React-Flow shape: { nodes: [{ id, data, position, type }], edges: [{ id, source, target, data, ... }] }
// We don't compute positions on the server — the frontend will run an automatic layout.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;
    const [entities, relationships] = await Promise.all([
      prisma.entity.findMany({ where: { campaignId } }),
      prisma.relationship.findMany({ where: { campaignId } }),
    ]);

    const nodes = entities.map((e) => ({
      id: e.id,
      type: 'loreNode',
      position: { x: 0, y: 0 },
      data: {
        name: e.name,
        entityType: e.type,
        description: e.description,
        visibility: e.visibility,
        status: e.status,
        importance: e.importance,
        confidenceScore: e.confidenceScore,
        sourceExcerpt: e.sourceExcerpt,
        imagePrompt: e.imagePrompt,
        isUncertain: e.isUncertain,
      },
    }));

    const edges = relationships.map((r) => ({
      id: r.id,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      type: 'loreEdge',
      animated: r.status === 'escalating',
      data: {
        relationshipType: r.type,
        description: r.description,
        intensity: r.intensity,
        visibility: r.visibility,
        status: r.status,
        confidenceScore: r.confidenceScore,
        sourceExcerpt: r.sourceExcerpt,
        isUncertain: r.isUncertain,
      },
    }));

    res.json({ nodes, edges });
  }),
);

export default router;
