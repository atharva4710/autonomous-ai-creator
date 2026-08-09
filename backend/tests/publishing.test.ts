import { PublishingService } from '../src/services/publishing.service';
import { ContentGenerationService } from '../src/services/contentGeneration.service';
import { globalTopicRepository } from '../src/repositories/topic.repository';
import { globalPostRepository } from '../src/repositories/post.repository';
import { globalEditorialRepository } from '../src/repositories/editorial.repository';
import { globalAgentRepository } from '../src/repositories/agent.repository';
import { Post } from '../src/models/post.interface';
import { Topic } from '../src/models/topic.interface';
import { EditorialDecision } from '../src/models/editorial.interface';

describe('PublishingService On-Demand Generation Tests', () => {
  const agentId = 'agent-pub-test';
  const topicId = 'topic-pub-test';

  const mockTopic: Topic = {
    id: topicId,
    agentId,
    title: 'Test Topic for On-Demand Publishing',
    summary: 'Test summary',
    source: { name: 'TechCrunch', url: 'https://techcrunch.com/test' },
    publishedAt: new Date().toISOString(),
    discoveredAt: new Date().toISOString(),
  };

  const mockDecision: EditorialDecision = {
    id: 'decision-pub-test',
    agentId,
    topicId,
    decision: 'ACCEPT',
    scores: {
      relevance: 90,
      personaAlignment: 85,
      timeliness: 90,
      importance: 80,
      novelty: 80,
      sourceQuality: 90,
      overall: 86,
    },
    reason: 'Accepted for test',
    evaluatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    await globalAgentRepository.save({
      agentId,
      persona: {
        name: 'Ada',
        domain: 'AI Security',
        role: 'Researcher',
        description: 'Test description',
        interests: ['security'],
        expertise: ['AI'],
        tone: ['analytical'],
        editorialPrinciples: ['Evidence'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    });
    await globalTopicRepository.save(mockTopic);
    await globalEditorialRepository.save(mockDecision);
  });

  test('Test case 1: Existing draft is found, publishPost() publishes it, generateContent() is NOT called', async () => {
    const existingDraft: Post = {
      id: 'post-existing-123',
      agentId,
      topicId,
      decisionId: mockDecision.id,
      status: 'DRAFT',
      text: 'Existing draft text',
      sources: ['https://techcrunch.com/test'],
      regenerationsCount: 0,
      createdAt: new Date().toISOString(),
    };
    await globalPostRepository.save(existingDraft);

    const mockContentGenService = {
      generateContent: jest.fn(),
    } as unknown as ContentGenerationService;

    const publishingService = new PublishingService(mockContentGenService);
    const result = await publishingService.publishPost(agentId, topicId);

    expect(result.status).toBe('PUBLISHED');
    expect(result.id).toBe('post-existing-123');
    expect(mockContentGenService.generateContent).not.toHaveBeenCalled();
  });

  test('Test case 2: No existing draft is found, generateContent(agentId, topicId) is called once, and the generated Post is published', async () => {
    const freshTopicId = 'topic-pub-ondemand';
    await globalTopicRepository.save({ ...mockTopic, id: freshTopicId });
    await globalEditorialRepository.save({ ...mockDecision, topicId: freshTopicId });

    const generatedDraft: Post = {
      id: 'post-ondemand-456',
      agentId,
      topicId: freshTopicId,
      decisionId: mockDecision.id,
      status: 'DRAFT',
      text: 'On demand generated draft text',
      sources: ['https://techcrunch.com/test'],
      regenerationsCount: 0,
      createdAt: new Date().toISOString(),
    };

    const mockContentGenService = {
      generateContent: jest.fn().mockImplementation(async () => {
        await globalPostRepository.save(generatedDraft);
        return generatedDraft;
      }),
    } as unknown as ContentGenerationService;

    const publishingService = new PublishingService(mockContentGenService);
    const result = await publishingService.publishPost(agentId, freshTopicId);

    expect(mockContentGenService.generateContent).toHaveBeenCalledTimes(1);
    expect(mockContentGenService.generateContent).toHaveBeenCalledWith(agentId, freshTopicId);
    expect(result.status).toBe('PUBLISHED');
    expect(result.id).toBe('post-ondemand-456');
  });

  test('Test case 3: No existing draft, generateContent() fails, publishPost() does not attempt publishing and propagates the original error', async () => {
    const errorTopicId = 'topic-pub-error';
    await globalTopicRepository.save({ ...mockTopic, id: errorTopicId });
    await globalEditorialRepository.save({ ...mockDecision, topicId: errorTopicId });

    const mockContentGenService = {
      generateContent: jest.fn().mockRejectedValue(new Error('AI provider rate limit 429')),
    } as unknown as ContentGenerationService;

    const publishingService = new PublishingService(mockContentGenService);

    await expect(publishingService.publishPost(agentId, errorTopicId)).rejects.toThrow(
      'AI provider rate limit 429'
    );
    expect(mockContentGenService.generateContent).toHaveBeenCalledTimes(1);
  });
});
