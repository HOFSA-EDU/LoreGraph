import { Router } from 'express';
import { getAnalyzerStatus } from '../analyzers';

const router = Router();

// Lets the frontend decide whether the "LLM" mode button can be enabled.
// Never returns the API key itself — only whether one is needed/configured.
router.get('/', (_req, res) => {
  res.json(getAnalyzerStatus());
});

export default router;
