import { Request, Response, NextFunction } from 'express';
import { MemoryService } from '../services/memory.service';
import { globalMemoryRepository } from '../repositories/memory.repository';
import { agentService } from './agent.controller';
import { globalTopicRepository } from '../repositories/topic.repository';

export const memoryService = new MemoryService(globalMemoryRepository);

/**
 * Checks if a topic has already been encountered.
 * Handles POST /api/agent/memory/check
 */
export const checkMemory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { agentId, topicId } = req.body;

    if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
      res.status(400).json({
        error: {
          message: 'agentId is required.',
          status: 400,
        },
      });
      return;
    }

    if (!topicId || typeof topicId !== 'string' || !topicId.trim()) {
      res.status(400).json({
        error: {
          message: 'topicId is required.',
          status: 400,
        },
      });
      return;
    }

    const trimmedAgentId = agentId.trim();
    const trimmedTopicId = topicId.trim();

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

    // Confirm topic exists
    const topic = await globalTopicRepository.findById(trimmedTopicId);
    if (!topic) {
      res.status(404).json({
        error: {
          message: 'Topic not found',
          status: 404,
        },
      });
      return;
    }

    // Verify ownership
    if (topic.agentId !== trimmedAgentId) {
      res.status(403).json({
        error: {
          message: 'Topic does not belong to the specified agent',
          status: 403,
        },
      });
      return;
    }

    const match = await memoryService.checkTopicHistory(
      trimmedAgentId,
      trimmedTopicId,
      topic.title,
      topic.source.url
    );

    res.status(200).json({
      memory: match,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves full memory history list for an agent.
 * Handles GET /api/agent/memory?agentId=...
 */
export const getMemoryHistory = async (
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

    const memories = await memoryService.getAgentMemory(trimmedAgentId);

    // Map properties and return
    const mapped = memories.map((m) => ({
      id: m.id,
      type: m.type,
      topicId: m.topicId,
      title: m.title,
      decision: m.decision,
      score: m.score,
      createdAt: m.createdAt,
    }));

    res.status(200).json({
      memories: mapped,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves memory counts and statistics.
 * Handles GET /api/agent/memory/summary?agentId=...
 */
export const getMemorySummary = async (
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

    const summary = await memoryService.getMemorySummary(trimmedAgentId);

    res.status(200).json({
      summary,
    });
  } catch (error) {
    next(error);
  }
};
