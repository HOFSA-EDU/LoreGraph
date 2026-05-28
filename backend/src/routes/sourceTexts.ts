import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

const SOURCE_TYPES = [
  'lore', 'session_notes', 'adventure', 'character_backstory', 'other',
] as const;

const createSchema = z.object({
  title: z.string().optional().nullable(),
  rawText: z.string().min(1),
  sourceType: z.enum(SOURCE_TYPES).default('other'),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;
    const data = createSchema.parse(req.body);
    const created = await prisma.campaignSourceText.create({
      data: { ...data, campaignId },
    });
    res.status(201).json(created);
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;
    const items = await prisma.campaignSourceText.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  }),
);

export default router;
