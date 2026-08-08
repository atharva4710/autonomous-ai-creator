import { Router } from 'express';
import healthRoutes from './health.routes';
import agentRoutes from './agent.routes';
import discoveryRoutes from './discovery.routes';

const router = Router();

// Register health endpoint routes under /health
router.use('/health', healthRoutes);

// Register agent endpoint routes under /api/agent
router.use('/api/agent', agentRoutes);
router.use('/api/agent', discoveryRoutes);

export default router;
