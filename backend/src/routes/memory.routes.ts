import { Router } from 'express';
import { checkMemory, getMemoryHistory, getMemorySummary } from '../controllers/memory.controller';

const router = Router();

// Handle POST /api/agent/memory/check
router.post('/memory/check', checkMemory);

// Handle GET /api/agent/memory
router.get('/memory', getMemoryHistory);

// Handle GET /api/agent/memory/summary
router.get('/memory/summary', getMemorySummary);

export default router;
