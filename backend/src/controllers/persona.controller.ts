import { Request, Response, NextFunction } from 'express';
import { PersonaService } from '../services/persona.service';
import { globalAgentRepository } from '../repositories/agent.repository';

export const personaService = new PersonaService(globalAgentRepository);

/**
 * Retrieves the rich persona context for an agent.
 * Handles GET /api/agent/persona?agentId=...
 */
export const getPersona = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { agentId } = req.query;

    if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
      res.status(400).json({
        error: {
          message: 'Missing or invalid agentId parameter.',
          status: 400,
        },
      });
      return;
    }

    const trimmedAgentId = agentId.trim();
    const persona = await personaService.getPersonaContext(trimmedAgentId);

    if (!persona) {
      res.status(404).json({
        error: {
          message: 'Agent not found',
          status: 404,
        },
      });
      return;
    }

    res.status(200).json({
      persona,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates properties of a persona.
 * Handles PATCH /api/agent/persona
 */
export const updatePersona = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { agentId, persona } = req.body;

    if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
      res.status(400).json({
        error: {
          message: 'agentId is required.',
          status: 400,
        },
      });
      return;
    }

    if (!persona || typeof persona !== 'object') {
      res.status(400).json({
        error: {
          message: 'persona field is required and must be an object.',
          status: 400,
        },
      });
      return;
    }

    const trimmedAgentId = agentId.trim();

    try {
      const updatedPersona = await personaService.updatePersona(trimmedAgentId, persona);
      res.status(200).json({
        persona: updatedPersona,
      });
    } catch (error: any) {
      const status = error.message === 'Agent not found' ? 404 : 400;
      res.status(status).json({
        error: {
          message: error.message || 'Invalid updates',
          status,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};
