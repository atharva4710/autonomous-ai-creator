import { Request, Response, NextFunction } from 'express';
import { globalAgentRepository } from '../repositories/agent.repository';
import { globalPostRepository } from '../repositories/post.repository';

/**
 * Returns feed containing only published posts for the agent.
 * Handles GET /api/agent/feed?agentId=...
 */
export const getFeed = async (
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

    const posts = await globalPostRepository.findByAgentId(trimmedAgentId);

    // Filter published posts only
    const published = posts.filter((p) => p.status === 'PUBLISHED');

    // Sort newest first
    const sorted = published.sort(
      (a, b) => Date.parse(b.publishedAt || b.createdAt) - Date.parse(a.publishedAt || a.createdAt)
    );

    // Format response payload (enrich with topic and editorial sub-objects)
    const { globalTopicRepository } = require('../repositories/topic.repository');
    const { globalEditorialRepository } = require('../repositories/editorial.repository');

    const formatted = await Promise.all(
      sorted.map(async (p) => {
        const topic = await globalTopicRepository.findById(p.topicId);
        const decision = await globalEditorialRepository.findByTopicId(p.topicId);

        let textVal = p.text;
        if (p.content && p.selectedFormat) {
          const fmt = p.selectedFormat;
          if (fmt === 'blog' && p.content.blog) {
            textVal = p.content.blog.text;
          } else if (fmt === 'linkedin' && p.content.linkedin) {
            textVal = p.content.linkedin.text;
          } else if (fmt === 'x' && p.content.x) {
            textVal = p.content.x.text;
          }
        }

        return {
          id: p.id,
          createdAt: p.publishedAt || p.createdAt,
          text: textVal,
          rationale: p.rationale || '',
          sources: p.sources || [],
          topic: topic
            ? {
                id: topic.id,
                title: topic.title,
              }
            : null,
          editorial: decision
            ? {
                decision: decision.decision,
                score: decision.scores.overall,
              }
            : null,
          content: p.content || null,
          selectedFormat: p.selectedFormat || null,
        };
      })
    );

    res.status(200).json({
      posts: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns runtime loop parameters for frontend checkups.
 * Handles GET /api/agent/status?agentId=...
 */
export const getStatus = async (
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

    // Retrieve latest published post
    let latestPublishedPost: { id: string; title: string; publishedAt: string } | null = null;
    try {
      const posts = await globalPostRepository.findByAgentId(trimmedAgentId);
      const published = posts.filter((p) => p.status === 'PUBLISHED');
      if (published.length > 0) {
        const sorted = published.sort(
          (a, b) => Date.parse(b.publishedAt || b.createdAt) - Date.parse(a.publishedAt || a.createdAt)
        );
        const top = sorted[0];
        const { globalTopicRepository } = require('../repositories/topic.repository');
        const topic = await globalTopicRepository.findById(top.topicId);
        latestPublishedPost = {
          id: top.id,
          title: topic ? topic.title : top.text.slice(0, 60),
          publishedAt: top.publishedAt || top.createdAt,
        };
      }
    } catch (_) {}

    // Retrieve active cycle stage
    let currentStage = 'WAITING';
    try {
      const { globalAutonomousService } = require('../services/autonomous/autonomous.service');
      currentStage = globalAutonomousService.getCurrentStage(trimmedAgentId);
    } catch (_) {}

    // Retrieve latest activity type
    let lastActivityType: string | null = null;
    try {
      const { globalActivityService } = require('../services/activity.service');
      const latest = await globalActivityService.getLatestActivity(trimmedAgentId);
      if (latest) {
        lastActivityType = latest.type;
      }
    } catch (_) {}

    const intervalMs = Number(process.env.AUTONOMOUS_CYCLE_INTERVAL_MS) || 900000;
    const intervalMinutes = Math.round(intervalMs / 60000);

    res.status(200).json({
      agent: {
        id: agent.agentId,
        status: agent.status,
        persona: agent.persona,
        createdAt: agent.createdAt,
        lastCycleAt: agent.lastCycleAt || null,
        lastPublishedAt: agent.lastPublishedAt || null,
        nextCycleAt: agent.nextCycleAt || null,
        nextPublishAt: agent.nextCycleAt || null,
        intervalMinutes,
        currentStage,
        lastActivityType,
        latestPublishedPost,
      },
    });
  } catch (error) {
    next(error);
  }
};
