import { Router } from 'express';
import { initAgent } from '../controllers/agent.controller';

const router = Router();

// Handle POST /api/agent/init -> map to initAgent controller
router.post('/init', initAgent);

export default router;
