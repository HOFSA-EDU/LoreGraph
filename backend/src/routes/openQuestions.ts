import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.openQuestion.findMany({
      where: { campaignId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  }),
);

const updateSchema = z.object({
  resolved: z.boolean().optional(),
  question: z.string().min(1).optional(),
});

router.put(
  '/:questionId',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const updated = await prisma.openQuestion.update({
      where: { id: req.params.questionId },
      data,
    });
    res.json(updated);
  }),
);

router.delete(
  '/:questionId',
  asyncHandler(async (req, res) => {
    await prisma.openQuestion.delete({ where: { id: req.params.questionId } });
    res.status(204).end();
  }),
);

export default router;
