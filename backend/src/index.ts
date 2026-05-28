import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import campaignsRouter from './routes/campaigns';
import sourceTextsRouter from './routes/sourceTexts';
import analyzeRouter from './routes/analyze';
import { campaignEntities, entitiesDirect } from './routes/entities';
import { campaignRelationships, relationshipsDirect } from './routes/relationships';
import graphRouter from './routes/graph';
import promptsRouter from './routes/prompts';
import sessionPrepRouter from './routes/sessionPrep';
import openQuestionsRouter from './routes/openQuestions';
import analyzerStatusRouter from './routes/analyzerStatus';
import imagesRouter from './routes/images';
import { exportRouter, importRouter } from './routes/importExport';
import { uploadsRoot } from './services/imageGenerator';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') }));
app.use(express.json({ limit: '5mb' }));

// Serve generated entity images.
app.use('/uploads', express.static(uploadsRoot()));

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/campaigns', campaignsRouter);
app.use('/api/campaigns/:id/source-texts', sourceTextsRouter);
app.use('/api/campaigns/:id/analyze', analyzeRouter);
app.use('/api/campaigns/:id/entities', campaignEntities);
app.use('/api/entities', entitiesDirect);
app.use('/api/campaigns/:id/relationships', campaignRelationships);
app.use('/api/relationships', relationshipsDirect);
app.use('/api/campaigns/:id/graph', graphRouter);
app.use('/api/campaigns/:id/generated-prompts', promptsRouter);
app.use('/api/campaigns/:id/open-questions', openQuestionsRouter);
app.use('/api/campaigns/:id/session-prep', sessionPrepRouter);
app.use('/api/campaigns/:id/export', exportRouter);
app.use('/api/campaigns/import', importRouter);
app.use('/api/analyzer/status', analyzerStatusRouter);
app.use('/api/images', imagesRouter);

// Centralized error handler — keep zod surface clean for the frontend.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'validation_error', issues: err.issues });
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[error]', err);
  res.status(500).json({ error: 'internal_error', message });
});

app.listen(PORT, () => {
  console.log(`[loregraph] backend listening on ${PORT}`);
});
