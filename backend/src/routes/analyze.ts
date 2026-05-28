import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { getAnalyzer, resolveAnalyzerMode } from '../analyzers';
import { normalizeAnalyzerResult } from '../validators/analyzerResult';
import { persistAnalyzerResult } from '../services/persistAnalyzerResult';

const router = Router({ mergeParams: true });

const SOURCE_TYPES = [
  'lore', 'session_notes', 'adventure', 'character_backstory', 'other',
] as const;

const bodySchema = z.object({
  text: z.string().min(1, 'text darf nicht leer sein'),
  sourceType: z.enum(SOURCE_TYPES).default('other'),
  // Optional override; when omitted the server uses ANALYZER_PROVIDER env.
  mode: z.enum(['mock', 'llm']).optional(),
  // preview: true skips persistence — the analyzer output is returned as-is.
  preview: z.boolean().default(false),
  storeSourceText: z.boolean().default(true),
  title: z.string().optional(),
  // When true and llm is requested but not configured, silently fall back to
  // mock. Default false — surfacing the misconfiguration is usually better.
  allowFallback: z.boolean().default(false),
});

// POST /api/campaigns/:id/analyze
//
// Response:
//   {
//     analyzed: { entities, relationships, generatedPrompts, openQuestions },
//     persisted: null | { entityCount, relationshipCount, promptCount, openQuestionCount, sourceTextId },
//     analyzerMode: "mock" | "llm",
//     fellBackFromLLM?: { reason: string }
//   }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;
    const body = bodySchema.parse(req.body);

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    let resolution;
    try {
      resolution = resolveAnalyzerMode(body.mode, { strict: !body.allowFallback });
    } catch (err) {
      const code = (err as { code?: string }).code;
      return res.status(code === 'llm_not_configured' ? 503 : 500).json({
        error: code ?? 'analyzer_resolution_failed',
        message: (err as Error).message,
      });
    }

    let analyzed;
    try {
      const analyzer = getAnalyzer(resolution.mode);
      const raw = await analyzer.analyze({ text: body.text, sourceType: body.sourceType });
      analyzed = normalizeAnalyzerResult(raw);
    } catch (err) {
      return res.status(503).json({
        error: 'analyzer_failed',
        message: (err as Error).message,
        analyzerMode: resolution.mode,
      });
    }

    if (body.preview) {
      return res.json({
        analyzed,
        persisted: null,
        analyzerMode: resolution.mode,
        ...(resolution.fellBackFromLLM
          ? { fellBackFromLLM: { reason: resolution.reason ?? 'unknown' } }
          : {}),
      });
    }

    let sourceTextId: string | null = null;
    if (body.storeSourceText) {
      const st = await prisma.campaignSourceText.create({
        data: {
          campaignId,
          title: body.title ?? null,
          rawText: body.text,
          sourceType: body.sourceType,
        },
      });
      sourceTextId = st.id;
    }

    await persistAnalyzerResult(prisma, campaignId, analyzed);

    const [entityCount, relationshipCount, promptCount, openQuestionCount] = await Promise.all([
      prisma.entity.count({ where: { campaignId } }),
      prisma.relationship.count({ where: { campaignId } }),
      prisma.generatedPrompt.count({ where: { campaignId } }),
      prisma.openQuestion.count({ where: { campaignId } }),
    ]);

    res.json({
      analyzed,
      persisted: {
        entityCount,
        relationshipCount,
        promptCount,
        openQuestionCount,
        sourceTextId,
      },
      analyzerMode: resolution.mode,
      ...(resolution.fellBackFromLLM
        ? { fellBackFromLLM: { reason: resolution.reason ?? 'unknown' } }
        : {}),
    });
  }),
);

export default router;
