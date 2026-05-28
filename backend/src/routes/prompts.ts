import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router({ mergeParams: true });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.generatedPrompt.findMany({
      where: { campaignId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  }),
);

router.delete(
  '/:promptId',
  asyncHandler(async (req, res) => {
    await prisma.generatedPrompt.delete({ where: { id: req.params.promptId } });
    res.status(204).end();
  }),
);

export default router;
