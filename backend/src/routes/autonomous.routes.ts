import { Router } from 'express';
import { getFeed, getStatus } from '../controllers/autonomous.controller';

const router = Router();

// Handle GET /api/agent/feed
router.get('/feed', getFeed);

// Handle GET /api/agent/status
router.get('/status', getStatus);

export default router;
