import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import {
  ImageGenerationError,
  buildImagePrompt,
  generateImage,
  loadImageConfigFromEnv,
  saveEntityImage,
  supportsImageType,
} from '../services/imageGenerator';

const router = Router();

const generateSchema = z.object({ entityId: z.string().min(1) });

// POST /api/images/generate — generate (or regenerate) an image for one entity
// from its stored prompt, persist it, and save the URL on the entity.
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const { entityId } = generateSchema.parse(req.body);

    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
      return res.status(404).json({ error: 'entity_not_found', message: 'Entität nicht gefunden.' });
    }

    if (!supportsImageType(entity.type)) {
      return res.status(400).json({
        error: 'unsupported_type',
        message: `Für den Typ "${entity.type}" wird keine Bildgenerierung unterstützt.`,
      });
    }

    try {
      const cfg = loadImageConfigFromEnv();
      const prompt = buildImagePrompt(entity);
      const image = await generateImage(prompt, cfg);
      const imageUrl = await saveEntityImage(entity.id, image);

      const updated = await prisma.entity.update({
        where: { id: entity.id },
        data: { imageUrl, imageGeneratedAt: new Date() },
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof ImageGenerationError) {
        const status =
          err.code === 'image_not_configured' ? 503 : err.code === 'unsupported_type' ? 400 : 502;
        return res.status(status).json({ error: err.code ?? 'image_generation_failed', message: err.message });
      }
      throw err;
    }
  }),
);

export default router;
