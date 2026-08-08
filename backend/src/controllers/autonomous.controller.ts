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

        return {
          id: p.id,
          createdAt: p.publishedAt || p.createdAt,
          text: p.text,
          rationale: p.rationale,
          sources: p.sources,
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

    // Retrieve latest activity type
    let lastActivityType: string | null = null;
    try {
      const { globalActivityService } = require('../services/activity.service');
      const latest = await globalActivityService.getLatestActivity(trimmedAgentId);
      if (latest) {
        lastActivityType = latest.type;
      }
    } catch (_) {}

    res.status(200).json({
      agent: {
        id: agent.agentId,
        status: agent.status,
        lastCycleAt: agent.lastCycleAt || null,
        lastPublishedAt: agent.lastPublishedAt || null,
        nextCycleAt: agent.nextCycleAt || null,
        lastActivityType,
      },
    });
  } catch (error) {
    next(error);
  }
};
