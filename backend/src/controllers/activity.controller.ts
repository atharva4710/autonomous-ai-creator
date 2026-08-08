import { Request, Response, NextFunction } from 'express';
import { globalAgentRepository } from '../repositories/agent.repository';
import { globalActivityService } from '../services/activity.service';

/**
 * Handles GET /api/agent/activity?agentId=abc-123&limit=50
 */
export const getActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { agentId, limit } = req.query;

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

    // Verify agent exists (agent isolation checks)
    const agent = await globalAgentRepository.findById(trimmedAgentId);
    if (!agent) {
      res.status(404).json({
        error: {
          message: 'Agent not found',
          status: 404,
        },
      });
      return;
    }

    let parsedLimit = 50;
    if (limit) {
      const parsed = parseInt(limit as string, 10);
      if (!isNaN(parsed)) {
        parsedLimit = parsed;
      }
    }

    const events = await globalActivityService.getAgentActivity(trimmedAgentId, parsedLimit);

    res.status(200).json({
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        message: e.message,
        topicId: e.topicId,
        postId: e.postId,
        metadata: e.metadata,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles GET /api/agent/activity/summary?agentId=abc-123
 */
export const getActivitySummary = async (
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

    // Verify agent exists
    const agent = await globalAgentRepository.findById(trimmedAgentId);
    if (!agent) {
      res.status(404).json({
        error: {
          message: 'Agent not found',
          status: 404,
        },
      });
      return;
    }

    const summary = await globalActivityService.getActivitySummary(trimmedAgentId);

    res.status(200).json({
      summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles GET /api/agent/activity/latest?agentId=abc-123
 */
export const getLatestActivity = async (
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

    // Verify agent exists
    const agent = await globalAgentRepository.findById(trimmedAgentId);
    if (!agent) {
      res.status(404).json({
        error: {
          message: 'Agent not found',
          status: 404,
        },
      });
      return;
    }

    const latest = await globalActivityService.getLatestActivity(trimmedAgentId);

    res.status(200).json({
      event: latest,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles GET /api/agent/posts/:postId/explanation?agentId=abc-123
 */
export const getPostExplanation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;
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

    // Verify agent exists
    const agent = await globalAgentRepository.findById(trimmedAgentId);
    if (!agent) {
      res.status(404).json({
        error: {
          message: 'Agent not found',
          status: 404,
        },
      });
      return;
    }

    try {
      const explanation = await globalActivityService.getPostExplanation(
        trimmedAgentId,
        postId
      );
      res.status(200).json({
        explanation,
      });
    } catch (err: any) {
      if (err.message.includes('not found')) {
        res.status(404).json({
          error: {
            message: err.message,
            status: 404,
          },
        });
      } else if (err.message.includes('Access denied')) {
        res.status(403).json({
          error: {
            message: err.message,
            status: 403,
          },
        });
      } else {
        throw err;
      }
    }
  } catch (error) {
    next(error);
  }
};
