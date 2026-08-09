import crypto from 'crypto';
import { Post } from '../models/post.interface';
import { IPostRepository } from '../repositories/post.repository';
import { globalPostRepository } from '../repositories/post.repository';
import { globalAgentRepository } from '../repositories/agent.repository';
import { globalTopicRepository } from '../repositories/topic.repository';
import { globalEditorialRepository } from '../repositories/editorial.repository';
import { IAIProvider, globalAIProvider, GenerationInput } from './aiProvider';
import { globalMemoryRepository } from '../repositories/memory.repository';
import { ContentGenerationError } from '../utils/errors';
import { retry, withTimeout } from '../utils/retry';
import { globalActivityService } from './activity.service';
import { memoryService } from '../controllers/memory.controller';

export class ContentGenerationService {
  private postRepository: IPostRepository;
  private aiProvider: IAIProvider;
  private MAX_POST_LENGTH = 4000;
  private MAX_REGENERATIONS = 3;

  constructor(postRepository: IPostRepository, aiProvider: IAIProvider) {
    this.postRepository = postRepository;
    this.aiProvider = aiProvider;
  }

  /**
   * Helper validator to ensure generated text meets target bounds.
   */
  private validateContent(text: string, content?: any): void {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Generated content is empty.');
    }

    if (text.length > this.MAX_POST_LENGTH) {
      throw new Error(
        `Generated content length (${text.length}) exceeds the maximum limit of ${this.MAX_POST_LENGTH} characters.`
      );
    }

    const lowerText = text.toLowerCase();
    const markers = [
      '[insert name]',
      '[placeholder]',
      'here is your post',
      'system prompt',
      'insert role',
      'rapidly evolving landscape',
      'ever-changing world',
      'here is a linkedin post',
      'here is the blog',
      'lorem ipsum',
      'todo:',
    ];

    for (const marker of markers) {
      if (lowerText.includes(marker)) {
        throw new Error(
          `Generated content contains unexpected commentary or placeholder marker: "${marker}"`
        );
      }
    }

    if (content) {
      if (content.blog?.text && content.linkedin?.text) {
        if (content.blog.text.trim() === content.linkedin.text.trim()) {
          throw new Error('Generated Blog and LinkedIn content cannot be identical.');
        }
      }
      if (content.linkedin?.text && content.x?.text) {
        if (content.linkedin.text.trim() === content.x.text.trim()) {
          throw new Error('Generated LinkedIn and X content cannot be identical.');
        }
      }
      if (content.x?.text && content.x.text.length > 280) {
        throw new Error('X post exceeds 280 characters limit.');
      }
    }
  }

  /**
   * Generates a new content draft from an accepted topic.
   */
  async generateContent(agentId: string, topicId: string): Promise<Post> {
    // 1. Confirm agent exists
    const agent = await globalAgentRepository.findById(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // 2. Confirm topic exists
    const topic = await globalTopicRepository.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    // 3. Verify ownership
    if (topic.agentId !== agentId) {
      throw new Error('Topic does not belong to this agent');
    }

    // 4. Confirm editorial decision exists and is ACCEPT
    const decision = await globalEditorialRepository.findByTopicId(topicId);
    if (!decision) {
      throw new Error('Editorial decision not found');
    }

    if (decision.decision !== 'ACCEPT') {
      throw new Error('Content cannot be generated for a rejected topic.');
    }

    // 5. If draft already exists, return it directly
    const existing = await this.postRepository.findByTopicId(agentId, topicId);
    if (existing) {
      return existing;
    }

    // 6. Pull memory context history
    let isKnown = false;
    let matchType: string | undefined;
    try {
      const match = await memoryService.checkTopicHistory(
        agentId,
        topicId,
        topic.title,
        topic.source.url
      );
      isKnown = match.isKnown;
      matchType = match.matchType;
    } catch (err) {}

    const input: GenerationInput = {
      persona: agent.persona,
      topic,
      editorialDecision: {
        decision: decision.decision,
        overallScore: decision.scores.overall,
        reason: decision.reason,
      },
      memoryContext: {
        isKnown,
        matchType,
      },
    };

    // 7. Record start activity event
    try {
      const providerName = process.env.GROQ_API_KEY ? 'GroqAIProvider' : 'MockAIProvider';
      await globalActivityService.recordEvent(
        agentId,
        'CONTENT_GENERATED',
        `Started multi-format content generation for topic "${topic.title}" using ${providerName}.`,
        topicId
      );
    } catch (_) {}

    // 8. Call AI Provider with Retry and Timeout
    let result: any;
    try {
      const timeoutMs = process.env.GROQ_API_KEY ? 15000 : 5000;
      const provider = this.aiProvider || globalAIProvider;
      result = await retry(
        () => withTimeout(() => provider.generateText(input), timeoutMs, 'AI Provider'),
        { maxAttempts: 2, delayMs: 200 }
      );
    } catch (err: any) {
      throw new ContentGenerationError(`AI provider failed after retries: ${err.message}`, err.retryable ?? true);
    }

    if (!result || typeof result.text !== 'string') {
      throw new ContentGenerationError('AI Provider returned malformed or empty text response.', true);
    }

    // 8. Validate content
    this.validateContent(result.text, result.content);

    // 9. Construct PostDraft
    const draftId = `post-${crypto.randomBytes(4).toString('hex')}`;
    const newDraft: Post = {
      id: draftId,
      agentId,
      topicId,
      decisionId: decision.id,
      status: 'VALIDATED',
      text: result.text,
      angle: result.angle,
      keyPoints: result.keyPoints,
      sources: [topic.source.url],
      regenerationsCount: 0,
      createdAt: new Date().toISOString(),
      content: result.content,
      selectedFormat: 'blog',
    };

    const savedDraft = await this.postRepository.save(newDraft);

    // Record activity events
    try {
      await globalActivityService.recordEvent(
        agentId,
        'CONTENT_GENERATED',
        `Generated draft content for topic: "${topic.title}".`,
        topicId,
        savedDraft.id
      );
      await globalActivityService.recordEvent(
        agentId,
        'POST_VALIDATED',
        `Draft post successfully validated: fits character limits and passes prompt safety checks.`,
        topicId,
        savedDraft.id
      );
    } catch (err: any) {
      console.error('[Content] Failed to record generation activity:', err.message);
    }

    // 10. Record CONTENT_GENERATED memory
    try {
      const memoryId = `memory-${crypto.randomBytes(4).toString('hex')}`;
      await globalMemoryRepository.save({
        id: memoryId,
        agentId,
        type: 'CONTENT_GENERATED',
        topicId,
        title: topic.title,
        summary: topic.summary,
        source: topic.source.url,
        postId: savedDraft.id,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Content] Failed to record generation memory:', err.message);
    }

    return savedDraft;
  }

  /**
   * Regenerates content for an existing draft up to max limit of 3.
   */
  async regenerateContent(agentId: string, topicId: string): Promise<Post> {
    // 1. Confirm agent exists
    const agent = await globalAgentRepository.findById(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // 2. Confirm topic exists
    const topic = await globalTopicRepository.findById(topicId);
    if (!topic) {
      throw new Error('Topic not found');
    }

    // 3. Verify ownership
    if (topic.agentId !== agentId) {
      throw new Error('Topic does not belong to this agent');
    }

    // 4. Retrieve existing draft
    const existing = await this.postRepository.findByTopicId(agentId, topicId);
    if (!existing) {
      throw new Error('Draft not found for this topic');
    }

    // 5. Enforce max regenerations limit
    if (existing.regenerationsCount >= this.MAX_REGENERATIONS) {
      throw new Error('Regeneration limit reached.');
    }

    // 6. Confirm decision is ACCEPT
    const decision = await globalEditorialRepository.findByTopicId(topicId);
    if (!decision || decision.decision !== 'ACCEPT') {
      throw new Error('Topic must have an ACCEPT decision.');
    }

    // 7. Pull memory context
    let isKnown = false;
    let matchType: string | undefined;
    try {
      const match = await memoryService.checkTopicHistory(
        agentId,
        topicId,
        topic.title,
        topic.source.url
      );
      isKnown = match.isKnown;
      matchType = match.matchType;
    } catch (err) {}

    const input: GenerationInput = {
      persona: agent.persona,
      topic,
      editorialDecision: {
        decision: decision.decision,
        overallScore: decision.scores.overall,
        reason: decision.reason,
      },
      memoryContext: {
        isKnown,
        matchType,
      },
    };

    // 8. Call AI Provider for fresh angle with Retry and Timeout
    let result: any;
    try {
      result = await retry(
        () => withTimeout(() => this.aiProvider.generateText(input), 5000, 'AI Provider'),
        { maxAttempts: 2, delayMs: 200 }
      );
    } catch (err: any) {
      throw new ContentGenerationError(`AI provider failed after retries: ${err.message}`, err.retryable ?? true);
    }

    if (!result || typeof result.text !== 'string') {
      throw new ContentGenerationError('AI Provider returned malformed or empty text response.', true);
    }

    // 9. Validate text
    this.validateContent(result.text, result.content);

    // 10. Update draft properties
    existing.text = result.text;
    existing.angle = result.angle;
    existing.keyPoints = result.keyPoints;
    existing.content = result.content;
    existing.selectedFormat = 'blog';
    existing.regenerationsCount += 1;
    existing.createdAt = new Date().toISOString();

    const savedDraft = await this.postRepository.save(existing);

    // Record activity events
    try {
      await globalActivityService.recordEvent(
        agentId,
        'CONTENT_GENERATED',
        `Generated regenerated draft content (attempt #${savedDraft.regenerationsCount}) for topic: "${topic.title}".`,
        topicId,
        savedDraft.id
      );
      await globalActivityService.recordEvent(
        agentId,
        'POST_VALIDATED',
        `Regenerated draft post successfully validated: fits character limits and passes prompt safety checks.`,
        topicId,
        savedDraft.id
      );
    } catch (err: any) {
      console.error('[Content] Failed to record regeneration activity:', err.message);
    }

    // 11. Record another memory log
    try {
      const memoryId = `memory-${crypto.randomBytes(4).toString('hex')}`;
      await globalMemoryRepository.save({
        id: memoryId,
        agentId,
        type: 'CONTENT_GENERATED',
        topicId,
        title: topic.title,
        summary: topic.summary,
        source: topic.source.url,
        postId: savedDraft.id,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Content] Failed to record regeneration memory:', err.message);
    }

    return savedDraft;
  }
}

export const globalContentGenerationService = new ContentGenerationService(
  globalPostRepository,
  globalAIProvider
);
