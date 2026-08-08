import { Router } from 'express';
import healthRoutes from './health.routes';
import agentRoutes from './agent.routes';
import discoveryRoutes from './discovery.routes';
import editorialRoutes from './editorial.routes';
import personaRoutes from './persona.routes';
import memoryRoutes from './memory.routes';
import contentGenerationRoutes from './contentGeneration.routes';
import autonomousRoutes from './autonomous.routes';
import activityRoutes from './activity.routes';

const router = Router();

// Register health endpoint routes under /health
router.use('/health', healthRoutes);

// Register agent endpoint routes under /api/agent
router.use('/api/agent', agentRoutes);
router.use('/api/agent', discoveryRoutes);
router.use('/api/agent', editorialRoutes);
router.use('/api/agent', personaRoutes);
router.use('/api/agent', memoryRoutes);
router.use('/api/agent', contentGenerationRoutes);
router.use('/api/agent', autonomousRoutes);
router.use('/api/agent', activityRoutes);

export default router;
