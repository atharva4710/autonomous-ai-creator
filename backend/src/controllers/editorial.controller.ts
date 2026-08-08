import { Request, Response, NextFunction } from 'express';
import { EditorialService } from '../services/editorial.service';
import { globalEditorialRepository } from '../repositories/editorial.repository';
import { globalTopicRepository } from '../repositories/topic.repository';
import { agentService } from './agent.controller';

// Shared repository and service instance for this run
export const editorialRepository = globalEditorialRepository;
export const topicRepository = globalTopicRepository;
export const editorialService = new EditorialService(editorialRepository);

/**
 * Evaluates a single topic.
 * Handles POST /api/agent/topics/:topicId/evaluate
 */
export const evaluateTopic = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { agentId } = req.body;
    const { topicId } = req.params;

    // Validate body structure
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
    const matchingTopic = await topicRepository.findById(trimmedTopicId);

    if (!matchingTopic) {
      res.status(404).json({
        error: {
          message: 'Topic not found',
          status: 404,
        },
      });
      return;
    }

    // Double-check if the topic belongs to the agent
    if (matchingTopic.agentId !== trimmedAgentId) {
      res.status(403).json({
        error: {
          message: 'Topic does not belong to the specified agent',
          status: 403,
        },
      });
      return;
    }

    // Perform evaluation
    const decision = await editorialService.evaluateTopic(agent, matchingTopic);

    res.status(200).json({
      decision,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Performs bulk evaluation for all discovered topics.
 * Handles POST /api/agent/topics/evaluate
 */
export const evaluateBulkTopics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { agentId } = req.body;

    if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
      res.status(400).json({
        error: {
          message: 'agentId is required.',
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

    // Fetch all topics associated with this agent
    const allTopics = await topicRepository.findByAgentId(trimmedAgentId);

    let evaluated = 0;
    let accepted = 0;
    let rejected = 0;
    const decisionsList = [];

    for (const topic of allTopics) {
      try {
        const decision = await editorialService.evaluateTopic(agent, topic);
        decisionsList.push(decision);
        evaluated++;
        if (decision.decision === 'ACCEPT') {
          accepted++;
        } else {
          rejected++;
        }
      } catch (err: any) {
        // Safe logging: one failed evaluation must not halt the bulk cycle
        console.error(`[Editorial] Error evaluating topic "${topic.id}":`, err.message);
      }
    }

    res.status(200).json({
      evaluated,
      accepted,
      rejected,
      decisions: decisionsList,
    });
  } catch (error) {
    next(error);
  }
};
