import { Router } from 'express';
import { getPersona, updatePersona } from '../controllers/persona.controller';

const router = Router();

// Handle GET /api/agent/persona
router.get('/persona', getPersona);

// Handle PATCH /api/agent/persona
router.patch('/persona', updatePersona);

export default router;
