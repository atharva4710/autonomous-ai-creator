import crypto from 'crypto';
import { Post } from '../models/post.interface';
import { globalPostRepository } from '../repositories/post.repository';
import { globalTopicRepository } from '../repositories/topic.repository';
import { globalEditorialRepository } from '../repositories/editorial.repository';
import { globalMemoryRepository } from '../repositories/memory.repository';
import { globalAgentRepository } from '../repositories/agent.repository';
import { globalActivityService } from './activity.service';
import { ContentGenerationService, globalContentGenerationService } from './contentGeneration.service';
import { PublishingError } from '../utils/errors';
import { retry } from '../utils/retry';

export class PublishingService {
  private contentGenerationService: ContentGenerationService;

  constructor(contentGenerationService?: ContentGenerationService) {
    this.contentGenerationService = contentGenerationService || globalContentGenerationService;
  }

  /**
   * Transition draft post to PUBLISHED, populating metadata.
   */
  async publishPost(agentId: string, topicId: string): Promise<Post> {
    try {
      // 1. Confirm topic exists
      const topic = await globalTopicRepository.findById(topicId);
      if (!topic) {
        throw new Error('Topic not found');
      }

      // 2. Retrieve existing draft post (or generate on demand if missing)
      let post = await globalPostRepository.findByTopicId(agentId, topicId);
      if (!post) {
        post = await this.contentGenerationService.generateContent(agentId, topicId);
      }

      // 3. Retrieve editorial decision and agent details for rationale
      const decision = await globalEditorialRepository.findByTopicId(topicId);
      const agent = await globalAgentRepository.findById(agentId);

      let rationale = '';
      if (agent && topic && decision) {
        const scores = decision.scores;
        const topAlt = (decision.comparativeAlternatives && decision.comparativeAlternatives.length > 0)
          ? decision.comparativeAlternatives[0]
          : null;

        const altCompText = topAlt
          ? `It was preferred over alternative candidate "${topAlt.title}" (score: ${topAlt.score}/100) because ${topAlt.rejectionReason}.`
          : `It ranked highest among all candidate topics evaluated during this crawling cycle.`;

        const timeDiffHours = Math.max(1, Math.round(Math.abs(Date.parse(topic.discoveredAt) - Date.parse(topic.publishedAt)) / (1000 * 60 * 60)));
        const freshText = timeDiffHours <= 24
          ? `published recently within the last ${timeDiffHours} hours`
          : `reported within recent active crawling cycles`;

        rationale = `Selected because it scored ${scores.overall}/100, with particularly strong persona relevance (${scores.relevance}/100), timeliness (${scores.timeliness}/100), and source quality (${scores.sourceQuality}/100). It aligns with ${agent.persona.name}'s focus as a ${agent.persona.role || 'expert'} in ${agent.persona.domain}. ${altCompText} The development is relevant now because it was ${freshText} via ${topic.source.name}. This is valuable to the persona's audience by providing actionable technical implications.`;
      } else {
        rationale = decision
          ? decision.reason
          : `Selected because the development is directly relevant to the persona domain, is newly reported, and matches editorial standards.`;
      }

      // 4. Update post status to PUBLISHED
      post.status = 'PUBLISHED';
      post.publishedAt = new Date().toISOString();
      post.rationale = rationale;
      post.sources = [topic.source.url];

      let savedPost: Post;
      try {
        savedPost = await retry(() => globalPostRepository.save(post), { maxAttempts: 3 });
      } catch (saveErr: any) {
        throw new PublishingError(`Database save failed during publishing: ${saveErr.message}`, false);
      }

      // Record activity event
      try {
        await globalActivityService.recordEvent(
          agentId,
          'POST_PUBLISHED',
          `Successfully published post: "${topic.title}".`,
          topicId,
          savedPost.id
        );
      } catch (activityErr: any) {
        console.error('[Publishing] Failed to record published activity:', activityErr.message);
      }

      // 5. Record PUBLISHED_POST memory
      try {
        const memoryId = `memory-${crypto.randomBytes(4).toString('hex')}`;
        await globalMemoryRepository.save({
          id: memoryId,
          agentId,
          type: 'PUBLISHED_POST',
          topicId,
          title: topic.title,
          summary: topic.summary,
          source: topic.source.url,
          postId: savedPost.id,
          createdAt: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error('[Publishing] Failed to log published post memory:', err.message);
      }

      return savedPost;
    } catch (err: any) {
      // Log PUBLISH_ERROR activity event
      try {
        await globalActivityService.recordEvent(
          agentId,
          'PUBLISH_ERROR',
          `Failed to publish post: ${err.message}`,
          topicId
        );
      } catch (activityErr: any) {
        console.error('[Publishing] Failed to log PUBLISH_ERROR activity:', activityErr.message);
      }
      throw err;
    }
  }
}

export const globalPublishingService = new PublishingService();
