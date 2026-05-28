import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

const upsertSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  system: z.string().optional().nullable(),
  tone: z.string().optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { entities: true, relationships: true, sourceTexts: true } },
      },
    });
    res.json(campaigns);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = upsertSchema.parse(req.body);
    const campaign = await prisma.campaign.create({ data });
    res.status(201).json(campaign);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { entities: true, relationships: true, sourceTexts: true } },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = upsertSchema.partial().parse(req.body);
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data,
    });
    res.json(campaign);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

export default router;
