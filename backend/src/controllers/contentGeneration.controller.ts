import { Request, Response, NextFunction } from 'express';
import { globalContentGenerationService } from '../services/contentGeneration.service';
import { globalPostRepository } from '../repositories/post.repository';
import { agentService } from './agent.controller';

/**
 * Handles POST /api/agent/content/generate
 */
export const generateDraft = async (
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

    try {
      const draft = await globalContentGenerationService.generateContent(
        trimmedAgentId,
        trimmedTopicId
      );

      res.status(200).json({
        post: draft,
      });
    } catch (err: any) {
      const msg = err.message;
      if (msg.includes('not found') || msg.includes('decision not found')) {
        res.status(404).json({
          error: {
            message: msg,
            status: 404,
          },
        });
      } else if (msg.includes('belong')) {
        res.status(403).json({
          error: {
            message: msg,
            status: 403,
          },
        });
      } else if (msg.includes('rejected topic')) {
        res.status(409).json({
          error: {
            message: msg,
            status: 409,
          },
        });
      } else {
        res.status(400).json({
          error: {
            message: msg,
            status: 400,
          },
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Handles POST /api/agent/content/regenerate
 */
export const regenerateDraft = async (
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

    try {
      const draft = await globalContentGenerationService.regenerateContent(
        trimmedAgentId,
        trimmedTopicId
      );

      res.status(200).json({
        post: draft,
      });
    } catch (err: any) {
      const msg = err.message;
      if (msg.includes('not found')) {
        res.status(404).json({
          error: {
            message: msg,
            status: 404,
          },
        });
      } else if (msg.includes('belong')) {
        res.status(403).json({
          error: {
            message: msg,
            status: 403,
          },
        });
      } else if (msg.includes('limit reached') || msg.includes('must have an ACCEPT decision')) {
        res.status(409).json({
          error: {
            message: msg,
            status: 409,
          },
        });
      } else {
        res.status(400).json({
          error: {
            message: msg,
            status: 400,
          },
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Handles GET /api/agent/content?agentId=...
 */
export const getDrafts = async (
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

    const drafts = await globalPostRepository.findByAgentId(trimmedAgentId);

    // Sort newest first
    const sorted = drafts.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );

    res.status(200).json({
      posts: sorted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles GET /api/agent/content/:postId?agentId=...
 */
export const getSingleDraft = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postId } = req.params;
    const { agentId } = req.query;

    if (!postId || typeof postId !== 'string' || !postId.trim()) {
      res.status(400).json({
        error: {
          message: 'postId path parameter is required.',
          status: 400,
        },
      });
      return;
    }

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

    // Retrieve post
    const post = await globalPostRepository.findById(postId);
    if (!post) {
      res.status(404).json({
        error: {
          message: 'Draft post not found',
          status: 404,
        },
      });
      return;
    }

    // Verify ownership
    if (post.agentId !== trimmedAgentId) {
      res.status(403).json({
        error: {
          message: 'Access denied: post belongs to another agent persona',
          status: 403,
        },
      });
      return;
    }

    res.status(200).json(post);
  } catch (error) {
    next(error);
  }
};
