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
            code: err.code || 'CONTENT_GENERATION_ERROR',
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
            code: err.code || 'CONTENT_GENERATION_ERROR',
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

/**
 * Handles POST /api/agent/content/select-format
 */
export const selectDraftFormat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { agentId, topicId, format } = req.body;

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

    if (!format || (format !== 'blog' && format !== 'linkedin' && format !== 'x')) {
      res.status(400).json({
        error: {
          message: 'format must be "blog", "linkedin" or "x".',
          status: 400,
        },
      });
      return;
    }

    const trimmedAgentId = agentId.trim();
    const trimmedTopicId = topicId.trim();

    const post = await globalPostRepository.findByTopicId(trimmedAgentId, trimmedTopicId);
    if (!post) {
      res.status(404).json({
        error: {
          message: 'Draft post not found for this topic.',
          status: 404,
        },
      });
      return;
    }

    post.selectedFormat = format;
    if (post.content) {
      if (format === 'blog' && post.content.blog) {
        post.text = post.content.blog.text;
      } else if (format === 'linkedin' && post.content.linkedin) {
        post.text = post.content.linkedin.text;
      } else if (format === 'x' && post.content.x) {
        post.text = post.content.x.text;
      }
    }

    const saved = await globalPostRepository.save(post);

    try {
      const { globalActivityService } = require('../services/activity.service');
      await globalActivityService.recordEvent(
        trimmedAgentId,
        'FORMAT_SELECTED',
        `Selected publishing format "${format}" for post: "${post.id}".`,
        trimmedTopicId,
        saved.id
      );
    } catch (_) {}

    res.status(200).json({
      post: saved,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles POST /api/agent/publish
 */
export const publishDraftPost = async (
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

    const { globalPublishingService } = require('../services/publishing.service');
    const published = await globalPublishingService.publishPost(agentId.trim(), topicId.trim());

    res.status(200).json({
      post: published,
    });
  } catch (error) {
    next(error);
  }
};
