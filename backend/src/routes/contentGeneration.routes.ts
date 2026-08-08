import { Router } from 'express';
import {
  generateDraft,
  regenerateDraft,
  getDrafts,
  getSingleDraft,
} from '../controllers/contentGeneration.controller';

const router = Router();

// Handle POST /api/agent/content/generate
router.post('/content/generate', generateDraft);

// Handle POST /api/agent/content/regenerate
router.post('/content/regenerate', regenerateDraft);

// Handle GET /api/agent/content
router.get('/content', getDrafts);

// Handle GET /api/agent/content/:postId
router.get('/content/:postId', getSingleDraft);

export default router;
