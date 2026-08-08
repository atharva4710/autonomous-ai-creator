import { Router } from 'express';
import { evaluateTopic, evaluateBulkTopics } from '../controllers/editorial.controller';

const router = Router();

// Handle POST /api/agent/topics/:topicId/evaluate
router.post('/topics/:topicId/evaluate', evaluateTopic);

// Handle POST /api/agent/topics/evaluate (Bulk Evaluation)
router.post('/topics/evaluate', evaluateBulkTopics);

export default router;
