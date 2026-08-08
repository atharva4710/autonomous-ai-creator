import { Request, Response, NextFunction } from 'express';
import { AgentService } from '../services/agent.service';
import { InMemoryAgentRepository } from '../repositories/agent.repository';

// Instantiate a single shared repository and service instance for this run
const agentRepository = new InMemoryAgentRepository();
export const agentService = new AgentService(agentRepository);

/**
 * Endpoint controller to initialize an agent.
 * Handles POST /api/agent/init
 */
export const initAgent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { persona } = req.body;

    // Validate body structure
    if (!persona || typeof persona !== 'object') {
      res.status(400).json({
        error: {
          message: 'Invalid request body. Persona field is required.',
          status: 400,
        },
      });
      return;
    }

    const { name, domain } = persona;

    // Validate values and reject if empty/whitespace-only/missing
    if (
      typeof name !== 'string' ||
      typeof domain !== 'string' ||
      !name.trim() ||
      !domain.trim()
    ) {
      res.status(400).json({
        error: {
          message: 'Invalid persona data',
          status: 400,
        },
      });
      return;
    }

    // Call service to initialize agent state
    const agent = await agentService.initializeAgent(name, domain);

    res.status(201).json({
      agentId: agent.agentId,
    });
  } catch (error) {
    next(error);
  }
};
