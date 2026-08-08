import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

// Register health endpoint routes under /health
router.use('/health', healthRoutes);

export default router;
