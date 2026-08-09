import { Request, Response, NextFunction } from 'express';
import { AgentService } from '../services/agent.service';
import { globalAgentRepository } from '../repositories/agent.repository';

// Instantiate a single shared repository and service instance for this run
export const agentRepository = globalAgentRepository;
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

    const { name, domain, ...rest } = persona;

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

    try {
      // Call service to initialize agent state
      const agent = await agentService.initializeAgent(name, domain, rest);

      // Record AGENT_INITIALIZED event
      try {
        const { globalActivityService } = require('../services/activity.service');
        await globalActivityService.recordEvent(
          agent.agentId,
          'AGENT_INITIALIZED',
          `Agent persona "${agent.persona.name}" initialized successfully for domain "${agent.persona.domain}".`
        );
      } catch (err: any) {
        console.error('Failed to log agent initialization activity:', err.message);
      }

      // Start autonomous loop in the background without blocking the HTTP response
      if (!process.env.JEST_WORKER_ID || process.env.AUTONOMOUS_ENABLED === 'true') {
        try {
          const { globalAutonomousService } = require('../services/autonomous/autonomous.service');
          globalAutonomousService.startAgentLoop(agent.agentId);
        } catch (err: any) {
          console.error('Failed to start autonomous loop:', err.message);
        }
      }

      res.status(201).json({
        agentId: agent.agentId,
      });
    } catch (error: any) {
      res.status(400).json({
        error: {
          message: error.message || 'Invalid persona data',
          status: 400,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};
