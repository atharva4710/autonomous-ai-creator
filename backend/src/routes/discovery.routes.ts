import { Router } from 'express';
import { discoverTopics, getTopics } from '../controllers/discovery.controller';

const router = Router();

// Handle POST /api/agent/discover
router.post('/discover', discoverTopics);

// Handle GET /api/agent/topics
router.get('/topics', getTopics);

export default router;
