import crypto from 'crypto';
import { ActivityEvent, ActivityType } from '../models/activity.interface';
import { globalActivityRepository } from '../repositories/activity.repository';
import { globalPostRepository } from '../repositories/post.repository';
import { globalTopicRepository } from '../repositories/topic.repository';
import { globalEditorialRepository } from '../repositories/editorial.repository';

export class ActivityService {
  /**
   * Records a new activity log event persistently.
   */
  async recordEvent(
    agentId: string,
    type: ActivityType,
    message: string,
    topicId?: string | null,
    postId?: string | null,
    metadata?: any
  ): Promise<ActivityEvent> {
    const eventId = `event-${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const event: ActivityEvent = {
      id: eventId,
      agentId,
      type,
      timestamp,
      message,
      topicId: topicId || null,
      postId: postId || null,
      metadata: metadata || {},
    };

    return globalActivityRepository.save(event);
  }

  /**
   * Retrieves activity list sorted newest first and limited by limit constraints.
   */
  async getAgentActivity(agentId: string, limit: number = 50): Promise<ActivityEvent[]> {
    // Enforce limit bounds (default: 50, maximum: 100)
    let finalLimit = limit;
    if (isNaN(finalLimit) || finalLimit <= 0) {
      finalLimit = 50;
    } else if (finalLimit > 100) {
      finalLimit = 100;
    }

    const events = await globalActivityRepository.findByAgentId(agentId);

    // Sort newest-first (descending timestamp)
    const sorted = events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    return sorted.slice(0, finalLimit);
  }

  /**
   * Compiles event summary metrics.
   */
  async getActivitySummary(agentId: string): Promise<any> {
    const events = await globalActivityRepository.findByAgentId(agentId);

    const cycles = events.filter((e) => e.type === 'CYCLE_STARTED').length;
    const topicsDiscovered = events.filter((e) => e.type === 'TOPIC_DISCOVERED').length;
    const topicsAccepted = events.filter((e) => e.type === 'TOPIC_ACCEPTED').length;
    const topicsRejected = events.filter((e) => e.type === 'TOPIC_REJECTED').length;
    const contentGenerated = events.filter((e) => e.type === 'CONTENT_GENERATED').length;
    const postsPublished = events.filter((e) => e.type === 'POST_PUBLISHED').length;

    // Failures include cycle failures and sub-event failures
    const failures = events.filter((e) =>
      ['CYCLE_FAILED', 'AI_ERROR', 'SOURCE_ERROR', 'PUBLISH_ERROR'].includes(e.type)
    ).length;

    return {
      cycles,
      topicsDiscovered,
      topicsAccepted,
      topicsRejected,
      contentGenerated,
      postsPublished,
      failures,
    };
  }

  /**
   * Retrieves the latest event log.
   */
  async getLatestActivity(agentId: string): Promise<ActivityEvent | null> {
    const events = await globalActivityRepository.findByAgentId(agentId);
    if (events.length === 0) {
      return null;
    }

    const sorted = events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return sorted[0];
  }

  /**
   * Compiles explainability metadata for a published post.
   */
  async getPostExplanation(agentId: string, postId: string): Promise<any> {
    const post = await globalPostRepository.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    if (post.agentId !== agentId) {
      throw new Error('Access denied: Post belongs to another agent.');
    }

    const topic = await globalTopicRepository.findById(post.topicId);
    if (!topic) {
      throw new Error('Associated topic not found');
    }

    const decision = await globalEditorialRepository.findByTopicId(post.topicId);
    const events = await globalActivityRepository.findByAgentId(agentId);

    // Locate the MEMORY_CHECKED event for this topic ID
    const memoryEvents = events.filter(
      (e) => e.type === 'MEMORY_CHECKED' && e.topicId === post.topicId
    );
    const isKnown = memoryEvents.length > 0 ? !!memoryEvents[0].metadata?.isKnown : false;

    return {
      post: {
        id: post.id,
        createdAt: post.createdAt,
        text: post.text,
        rationale: post.rationale || 'Selected based on domain principles.',
        sources: post.sources || (topic.source?.url ? [topic.source.url] : []),
        selectedFormat: post.selectedFormat,
        content: post.content,
      },
      rationale: post.rationale || 'Selected based on domain principles.',
      sources: post.sources || (topic.source?.url ? [topic.source.url] : []),
      topic: {
        id: topic.id,
        agentId: topic.agentId,
        title: topic.title,
        summary: topic.summary,
        source: topic.source,
        publishedAt: topic.publishedAt,
        discoveredAt: topic.discoveredAt,
      },
      decision: decision ? {
        id: decision.id,
        topicId: decision.topicId,
        decision: decision.decision,
        score: decision.scores?.overall ?? 0,
        scores: decision.scores,
        reason: decision.reason,
        evaluatedAt: decision.evaluatedAt,
        selectionRank: decision.selectionRank,
        comparativeAlternatives: decision.comparativeAlternatives,
      } : null,
      memory: {
        isKnown,
      },
    };
  }
}

export const globalActivityService = new ActivityService();
