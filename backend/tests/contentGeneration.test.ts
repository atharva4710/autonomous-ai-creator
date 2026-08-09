import request from 'supertest';
import app from '../src/server';
import { globalPostRepository } from '../src/repositories/post.repository';
import { globalTopicRepository } from '../src/repositories/topic.repository';
import { globalEditorialRepository } from '../src/repositories/editorial.repository';
import { globalMemoryRepository } from '../src/repositories/memory.repository';
import { globalAIProvider } from '../src/services/aiProvider';

describe('Content Generation Engine Endpoints & Integration', () => {
  let agentId: string;
  let topicIdAccepted: string;
  let topicIdRejected: string;
  let originalFetch: typeof global.fetch;

  beforeAll(async () => {
    process.env.AUTONOMOUS_ENABLED = 'false';
    originalFetch = global.fetch;

    // Mock fetch for Stage 2 checks
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Content Gen Headline</title>
      <link>https://example.com/item-gen-1</link>
      <description>General tech news description.</description>
      <pubDate>Sat, 08 Aug 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`),
      } as Response)
    );

    // Initialize Agent
    const res = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada',
          domain: 'AI Security',
          interests: ['prompt injection'],
          expertise: ['machine learning'],
          tone: ['analytical'],
          editorialPrinciples: ['Evidence over hype'],
        },
      });
    agentId = res.body.agentId;

    // Seed Topics and Decisions
    const now = new Date().toISOString();

    // 1. Accepted Topic
    const topicAcc = await globalTopicRepository.save({
      id: 'topic-acc-1',
      agentId,
      title: 'Vulnerability exploit in prompt injects',
      summary: 'Critical vulnerability discovered in conversational prompts.',
      source: { name: 'TechCrunch', url: 'https://tc.com/exploit1' },
      publishedAt: now,
      discoveredAt: now,
    });
    topicIdAccepted = topicAcc.id;

    await globalEditorialRepository.save({
      id: 'decision-acc-1',
      agentId,
      topicId: topicIdAccepted,
      decision: 'ACCEPT',
      scores: {
        relevance: 90,
        personaAlignment: 90,
        timeliness: 90,
        importance: 90,
        novelty: 90,
        sourceQuality: 90,
        overall: 90,
      },
      reason: 'Highly relevant.',
      evaluatedAt: now,
    });

    // 2. Rejected Topic
    const topicRej = await globalTopicRepository.save({
      id: 'topic-rej-1',
      agentId,
      title: 'Baking bread with yeast',
      summary: 'Recipes to bake simple bread.',
      source: { name: 'TechCrunch', url: 'https://tc.com/bread' },
      publishedAt: now,
      discoveredAt: now,
    });
    topicIdRejected = topicRej.id;

    await globalEditorialRepository.save({
      id: 'decision-rej-1',
      agentId,
      topicId: topicIdRejected,
      decision: 'REJECT',
      scores: {
        relevance: 10,
        personaAlignment: 10,
        timeliness: 90,
        importance: 10,
        novelty: 10,
        sourceQuality: 90,
        overall: 30,
      },
      reason: 'Low relevance cooking topic.',
      evaluatedAt: now,
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('Draft Content Generation (POST /api/agent/content/generate)', () => {
    it('1. should generate content for accepted topic and return 200/201', async () => {
      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicIdAccepted });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('post');
      expect(res.body.post.topicId).toBe(topicIdAccepted);
      expect(res.body.post.status).toBe('VALIDATED');
    });

    it('2. should reject content generation with 409 Conflict for rejected topic', async () => {
      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicIdRejected });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('rejected topic');
    });

    it('3. should fail with HTTP 404 for missing agent', async () => {
      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId: 'agent-nonexistent999', topicId: topicIdAccepted });

      expect(res.status).toBe(404);
    });

    it('4. should fail with HTTP 404 for missing topic', async () => {
      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: 'topic-nonexistent999' });

      expect(res.status).toBe(404);
    });

    it('5. should fail with HTTP 404 for missing editorial decision', async () => {
      const now = new Date().toISOString();
      const topicNoDec = await globalTopicRepository.save({
        id: 'topic-no-dec',
        agentId,
        title: 'Topic without decision',
        summary: 'Description.',
        source: { name: 'TechCrunch', url: 'https://tc.com/nodec' },
        publishedAt: now,
        discoveredAt: now,
      });

      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicNoDec.id });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('decision not found');
    });
  });

  describe('AI Provider Checks and Content Validations', () => {
    it('6. should call AI provider successfully during generation', async () => {
      // Clear existing draft to trigger generation again
      const existing = await globalPostRepository.findByTopicId(agentId, topicIdAccepted);
      if (existing) {
        const mockRepo = globalPostRepository as any;
        mockRepo.posts.delete(existing.id);
      }

      const spy = jest.spyOn(globalAIProvider, 'generateText');
      await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicIdAccepted });

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('7. should fail safely with HTTP 400 when AI provider throws an error', async () => {
      const spy = jest.spyOn(globalAIProvider, 'generateText').mockImplementation(() => {
        throw new Error('AI Provider crash');
      });

      // Clear existing draft to trigger generation again
      const existing = await globalPostRepository.findByTopicId(agentId, topicIdAccepted);
      if (existing) {
        // delete from map internally (we can overwrite in repository using dummy status or bypass)
        const mockRepo = globalPostRepository as any;
        mockRepo.posts.delete(existing.id);
      }

      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicIdAccepted });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('AI Provider crash');
      spy.mockRestore();
    });

    it('8. should handle validation failure (e.g. metadata text or placeholder flags)', async () => {
      const spy = jest.spyOn(globalAIProvider, 'generateText').mockImplementationOnce(() =>
        Promise.resolve({
          text: 'Here is your post: [insert name] will speak about hacks',
          angle: 'Default angle',
          keyPoints: [],
        })
      );

      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicIdAccepted });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('unexpected commentary or placeholder marker');
      spy.mockRestore();
    });

    it('9. should handle empty generated content validation', async () => {
      const spy = jest.spyOn(globalAIProvider, 'generateText').mockImplementationOnce(() =>
        Promise.resolve({
          text: '  ',
          angle: 'Default',
          keyPoints: [],
        })
      );

      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicIdAccepted });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('content is empty');
      spy.mockRestore();
    });

    it('10. should validate maximum content length bounds (exceeding 1300 chars)', async () => {
      const spy = jest.spyOn(globalAIProvider, 'generateText').mockImplementationOnce(() =>
        Promise.resolve({
          text: 'a'.repeat(4500),
          angle: 'Long post',
          keyPoints: [],
        })
      );

      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicIdAccepted });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('exceeds the maximum limit');
      spy.mockRestore();
    });
  });

  describe('Draft Queries and Operations', () => {
    let savedPostId: string;

    beforeAll(async () => {
      // Re-generate a valid draft post
      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId: topicIdAccepted });
      savedPostId = res.body.post.id;
    });

    it('11. should verify draft is persisted in repository', async () => {
      const post = await globalPostRepository.findById(savedPostId);
      expect(post).not.toBeNull();
      expect(post?.text).toContain('Source reference:');
    });

    it('12. should retrieve list of agent draft posts (GET /api/agent/content)', async () => {
      const res = await request(app).get(`/api/agent/content?agentId=${agentId}`);
      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeGreaterThan(0);
      expect(res.body.posts[0].id).toBe(savedPostId);
    });

    it('13. should verify ownership blocks and reject cross-agent post queries', async () => {
      // Initialize Agent B
      const resB = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Nova',
            domain: 'Cooking',
          },
        });
      const agentBId = resB.body.agentId;

      // Query Agent A's draft using Agent B's query parameters
      const res = await request(app).get(`/api/agent/content/${savedPostId}?agentId=${agentBId}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Access denied');
    });
  });

  describe('Draft Regeneration Rules', () => {
    it('14. should successfully regenerate post draft with counter increment', async () => {
      const res = await request(app)
        .post('/api/agent/content/regenerate')
        .send({ agentId, topicId: topicIdAccepted });

      expect(res.status).toBe(200);
      expect(res.body.post.regenerationsCount).toBe(1);
    });

    it('15. should block regeneration requests when limit of 3 is reached', async () => {
      // Attempt 2
      await request(app).post('/api/agent/content/regenerate').send({ agentId, topicId: topicIdAccepted });
      // Attempt 3
      await request(app).post('/api/agent/content/regenerate').send({ agentId, topicId: topicIdAccepted });
      
      // Attempt 4 (Exceed limit)
      const res = await request(app)
        .post('/api/agent/content/regenerate')
        .send({ agentId, topicId: topicIdAccepted });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Regeneration limit reached');
    });

    it('16. should verify source information is preserved in draft model', async () => {
      const draft = await globalPostRepository.findByTopicId(agentId, topicIdAccepted);
      expect(draft?.sources).toContain('https://tc.com/exploit1');
    });
  });

  describe('Persona and Memory Context integrations', () => {
    it('17. should pass persona context variables to prompt generator', async () => {
      const spy = jest.spyOn(globalAIProvider, 'generateText');
      
      // Reset regenerations to test trigger
      const draft = await globalPostRepository.findByTopicId(agentId, topicIdAccepted);
      if (draft) {
        draft.regenerationsCount = 0;
        await globalPostRepository.save(draft);
      }

      await request(app)
        .post('/api/agent/content/regenerate')
        .send({ agentId, topicId: topicIdAccepted });

      const input = spy.mock.calls[0][0];
      expect(input.persona.name).toBe('Ada');
      expect(input.persona.role).toBe('AI Security Researcher');
      spy.mockRestore();
    });

    it('18. should pass memory matching context information to AI Provider input', async () => {
      const spy = jest.spyOn(globalAIProvider, 'generateText');
      
      // Seed evaluated memory for topicIdAccepted
      await globalMemoryRepository.save({
        id: 'mem-seed-1',
        agentId,
        type: 'ACCEPTED_TOPIC',
        topicId: topicIdAccepted,
        title: 'Vulnerability exploit in prompt injects',
        summary: 'Summary text.',
        source: 'https://tc.com/exploit1',
        createdAt: new Date().toISOString(),
      });

      // Reset counter
      const draft = await globalPostRepository.findByTopicId(agentId, topicIdAccepted);
      if (draft) {
        draft.regenerationsCount = 0;
        await globalPostRepository.save(draft);
      }

      await request(app)
        .post('/api/agent/content/regenerate')
        .send({ agentId, topicId: topicIdAccepted });

      const input = spy.mock.calls[0][0];
      expect(input.memoryContext.isKnown).toBe(true);
      expect(input.memoryContext.matchType).toBe('EXACT_TOPIC_ID');
      spy.mockRestore();
    });

    it('19. should record CONTENT_GENERATED memory logs inside memory repository', async () => {
      const list = await globalMemoryRepository.findByAgentId(agentId);
      const contentGens = list.filter((m) => m.type === 'CONTENT_GENERATED');
      expect(contentGens.length).toBeGreaterThan(0);
      expect(contentGens.some((m) => m.topicId === topicIdAccepted)).toBe(true);
    });
  });

  describe('Compatibility checks with previous stages', () => {
    it('20. Stage 5 memory summary route still works', async () => {
      const res = await request(app).get(`/api/agent/memory/summary?agentId=${agentId}`);
      expect(res.status).toBe(200);
      expect(res.body.summary.totalMemories).toBeGreaterThan(0);
    });

    it('21. Stage 4 persona configuration retrieval route still works', async () => {
      const res = await request(app).get(`/api/agent/persona?agentId=${agentId}`);
      expect(res.status).toBe(200);
      expect(res.body.persona.name).toBe('Ada');
    });

    it('22. Stage 3 editorial evaluation route still works', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topicIdAccepted}/evaluate`)
        .send({ agentId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('decision');
    });

    it('23. Stage 2 live crawler discovery route still works', async () => {
      const res = await request(app)
        .post('/api/agent/discover')
        .send({ agentId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('discovered');
    });

    it('24. Stage 1 agent initialization route still works', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Nova',
            domain: 'AI Security',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('agentId');
    });

    it('25. health check endpoint GET /health still returns status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('Phase 6 — Professional AI Content Generation Quality Checks', () => {
    it('26. Sample Quality Test: multi-format content meets platform differentiation & hashtag requirements', async () => {
      const mockInput = {
        persona: {
          name: 'Ada',
          domain: 'AI Security',
          role: 'AI Security Researcher',
          description: 'AI Security Researcher',
          interests: ['prompt injection'],
          expertise: ['LLM safety'],
          tone: ['analytical'],
          editorialPrinciples: ['Evidence over hype'],
        },
        topic: {
          id: 'topic-sample-qual',
          agentId: 'agent-qual',
          title: 'Researchers discover a new prompt injection technique affecting AI agents',
          summary: 'A new zero-day prompt injection vulnerability allows unauthorized instruction execution in AI agent frameworks.',
          source: { name: 'ArXiv AI Security', url: 'https://arxiv.org/abs/2608.1234' },
          publishedAt: new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
        },
        editorialDecision: {
          decision: 'ACCEPT' as const,
          overallScore: 92,
          reason: 'High technical relevance and timeliness.',
        },
        memoryContext: {
          isKnown: false,
        },
      };

      const provider = new (require('../src/services/aiProvider').MockAIProvider)();
      const generated = await provider.generateText(mockInput);

      expect(generated.content).toBeDefined();
      const { blog, linkedin, x } = generated.content;

      // 1. Blog assertions
      expect(blog.title).toContain('Researchers discover a new prompt injection technique');
      expect(blog.text).toContain('## Overview');
      expect(blog.text).toContain('## Key Takeaways');

      // 2. LinkedIn assertions
      expect(linkedin.text).toContain('Key takeaways:');
      expect(linkedin.text).toContain('#AISecurity');
      expect(linkedin.text.length).toBeGreaterThan(50);

      // 3. X assertions
      expect(x.text.length).toBeLessThanOrEqual(280);
      expect(x.text).toContain('#AISecurity');

      // 4. Platform differentiation
      expect(blog.text).not.toEqual(linkedin.text);
      expect(linkedin.text).not.toEqual(x.text);
    });
  });
});
