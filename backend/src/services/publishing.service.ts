import crypto from 'crypto';
import { Post } from '../models/post.interface';
import { globalPostRepository } from '../repositories/post.repository';
import { globalTopicRepository } from '../repositories/topic.repository';
import { globalEditorialRepository } from '../repositories/editorial.repository';
import { globalMemoryRepository } from '../repositories/memory.repository';

export class PublishingService {
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

      // 2. Retrieve existing draft post
      const post = await globalPostRepository.findByTopicId(agentId, topicId);
      if (!post) {
        throw new Error('Draft not found for this topic');
      }

      // 3. Retrieve editorial decision for rationale
      const decision = await globalEditorialRepository.findByTopicId(topicId);
      const rationale = decision
        ? decision.reason
        : `Selected because the development is directly relevant to the persona domain, is newly reported, and matches editorial standards.`;

      // 4. Update post status to PUBLISHED
      post.status = 'PUBLISHED';
      post.publishedAt = new Date().toISOString();
      post.rationale = rationale;
      post.sources = [topic.source.url];

      const savedPost = await globalPostRepository.save(post);

      // Record activity event
      try {
        const { globalActivityService } = require('./activity.service');
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
        const { globalActivityService } = require('./activity.service');
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
