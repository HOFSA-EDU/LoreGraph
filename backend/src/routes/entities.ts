import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const ENTITY_TYPES = [
  'player_character', 'npc', 'faction', 'location', 'item', 'secret', 'event', 'unknown',
] as const;
const VISIBILITY = ['public', 'gm_only'] as const;
const STATUS = ['active', 'dead', 'missing', 'destroyed', 'unknown'] as const;
const IMPORTANCE = ['low', 'medium', 'high', 'critical'] as const;

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(ENTITY_TYPES).default('unknown'),
  description: z.string().optional().nullable(),
  visibility: z.enum(VISIBILITY).default('public'),
  status: z.enum(STATUS).default('active'),
  importance: z.enum(IMPORTANCE).default('medium'),
  confidenceScore: z.number().min(0).max(1).default(1),
  sourceExcerpt: z.string().optional().nullable(),
  imagePrompt: z.string().optional().nullable(),
  isUncertain: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

// Mounted on /api/campaigns/:id/entities
export const campaignEntities = Router({ mergeParams: true });

campaignEntities.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.entity.findMany({
      where: { campaignId: req.params.id },
      orderBy: [{ importance: 'desc' }, { name: 'asc' }],
    });
    res.json(items);
  }),
);

campaignEntities.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const created = await prisma.entity.create({
      data: { ...data, campaignId: req.params.id },
    });
    res.status(201).json(created);
  }),
);

// Mounted on /api/entities/:entityId
export const entitiesDirect = Router();

entitiesDirect.put(
  '/:entityId',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const updated = await prisma.entity.update({
      where: { id: req.params.entityId },
      data,
    });
    res.json(updated);
  }),
);

entitiesDirect.delete(
  '/:entityId',
  asyncHandler(async (req, res) => {
    await prisma.entity.delete({ where: { id: req.params.entityId } });
    res.status(204).end();
  }),
);
