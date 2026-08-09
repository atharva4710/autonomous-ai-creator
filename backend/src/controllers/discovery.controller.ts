import { Request, Response, NextFunction } from 'express';
import { DiscoveryService } from '../services/discovery.service';
import { globalTopicRepository } from '../repositories/topic.repository';
import { agentService } from './agent.controller';

// Shared repository and service instance for this run
export const topicRepository = globalTopicRepository;
export const discoveryService = new DiscoveryService(topicRepository, agentService);

/**
 * Triggers the Live Topic Discovery cycle for an agent.
 * Handles POST /api/agent/discover
 */
export const discoverTopics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { agentId } = req.body;

    if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
      res.status(400).json({
        error: {
          message: 'Invalid request body. agentId is required.',
          status: 400,
        },
      });
      return;
    }

    const trimmedAgentId = agentId.trim();

    // Confirm agent exists before discover
    const agent = await agentService.getAgentById(trimmedAgentId);
    if (!agent) {
      res.status(404).json({
        error: {
          message: 'Agent not found',
          status: 404,
        },
      });
      return;
    }

    const discoveredCount = await discoveryService.discover(trimmedAgentId);

    res.status(200).json({
      discovered: discoveredCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves the discovered topics list for an agent.
 * Handles GET /api/agent/topics?agentId=...
 */
export const getTopics = async (
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

    // Confirm agent exists
    const agent = await agentService.getAgentById(trimmedAgentId);
    if (!agent) {
      res.status(404).json({
        error: {
          message: 'Agent not found',
          status: 404,
        },
      });
      return;
    }

    const rawTopics = await topicRepository.findByAgentId(trimmedAgentId);

    // Enrich topics with editorial decision if present
    const { globalEditorialRepository } = require('../repositories/editorial.repository');
    const enrichedTopics = await Promise.all(
      rawTopics.map(async (t) => {
        const decision = await globalEditorialRepository.findByTopicId(t.id);
        return {
          ...t,
          decision: decision || undefined,
        };
      })
    );

    // Sort by discoveredAt descending (newest first)
    const sortedTopics = enrichedTopics.sort(
      (a, b) => Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt)
    );

    res.status(200).json({
      topics: sortedTopics,
    });
  } catch (error) {
    next(error);
  }
};
