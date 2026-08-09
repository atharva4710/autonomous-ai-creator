import { Router } from 'express';
import {
  generateDraft,
  regenerateDraft,
  getDrafts,
  getSingleDraft,
  selectDraftFormat,
  publishDraftPost,
} from '../controllers/contentGeneration.controller';

const router = Router();

// Handle POST /api/agent/content/generate
router.post('/content/generate', generateDraft);

// Handle POST /api/agent/content/regenerate
router.post('/content/regenerate', regenerateDraft);

// Handle POST /api/agent/content/select-format
router.post('/content/select-format', selectDraftFormat);

// Handle POST /api/agent/publish
router.post('/publish', publishDraftPost);

// Handle GET /api/agent/content
router.get('/content', getDrafts);

// Handle GET /api/agent/content/:postId
router.get('/content/:postId', getSingleDraft);

export default router;
