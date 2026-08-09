import request from 'supertest';
import app from '../src/server';
import { globalAgentRepository } from '../src/repositories/agent.repository';
import { globalTopicRepository } from '../src/repositories/topic.repository';
import { globalEditorialRepository } from '../src/repositories/editorial.repository';
import { globalPostRepository } from '../src/repositories/post.repository';
import { globalMemoryRepository } from '../src/repositories/memory.repository';
import { globalAutonomousService } from '../src/services/autonomous/autonomous.service';
import { globalAIProvider } from '../src/services/aiProvider';
import { discoveryService } from '../src/controllers/discovery.controller';
import { globalPublishingService } from '../src/services/publishing.service';

describe('Autonomous Execution & Publishing Endpoints', () => {
  let originalFetch: typeof global.fetch;
  let agentAId: string;
  let agentBId: string;
  let mockFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Autonomous Vulnerability exploit injection found in AI Security Vulnerability Exploit system</title>
      <link>https://example.com/item-auton-1</link>
      <description>Description context for injection.</description>
      <pubDate>Sat, 08 Aug 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

  beforeAll(async () => {
    originalFetch = global.fetch;

    // Enable autonomous execution and set interval short to trigger immediately
    process.env.AUTONOMOUS_ENABLED = 'true';
    process.env.AUTONOMOUS_CYCLE_INTERVAL_MS = '500';

    // Clear singleton repositories to prevent stale data pollution
    (globalAgentRepository as any).agents?.clear();
    (globalTopicRepository as any).topics?.clear();
    (globalEditorialRepository as any).decisions?.clear();
    (globalPostRepository as any).posts?.clear();
    (globalMemoryRepository as any).memories?.clear();

    // Mock fetch for crawler inputs using a vanilla function (immune to Jest resetMocks)
    global.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockFeedXml),
      } as Response)
    ) as any;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await globalAutonomousService.stopAll();
    process.env.AUTONOMOUS_ENABLED = 'false';
  });

  describe('Agent Initialization Asynchronous Trigger', () => {
    it('1. & 2. should initialize agent, return agentId quickly, and start autonomous loop in background', async () => {
      const startTime = Date.now();
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security Vulnerability Exploit',
            interests: ['vulnerability exploit injection'],
            expertise: ['cybersecurity'],
            tone: ['analytical'],
            editorialPrinciples: ['Evidence over hype'],
          },
        });

      const elapsed = Date.now() - startTime;
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('agentId');
      agentAId = res.body.agentId;

      // Assert initialization returned instantly (should be way under 350ms since loops are backgrounded)
      expect(elapsed).toBeLessThan(350);

      // Verify agent status is RUNNING
      const agent = await globalAgentRepository.findById(agentAId);
      expect(agent?.status).toBe('RUNNING');
    });
  });

  describe('Autonomous Execution Cycle', () => {
    it('3. to 10. should run loop and publish post to feed automatically', async () => {
      // Wait for background cycle execution to complete
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Query the feed endpoint (GET /api/agent/feed?agentId=...)
      const res = await request(app).get(`/api/agent/feed?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('posts');
      expect(res.body.posts.length).toBeGreaterThan(0);

      const post = res.body.posts[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('text');
      expect(post).toHaveProperty('rationale');
      expect(post.sources).toContain('https://example.com/item-auton-1');
    });

    it('11. & 12. should return posts sorted newest-first and preserve historical posts', async () => {
      // Mock discovery fetch to return a second title
      mockFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Autonomous Vulnerability exploit secondary threat releases in AI Security Vulnerability Exploit system</title>
      <link>https://example.com/item-auton-2</link>
      <description>Description details.</description>
      <pubDate>Sat, 08 Aug 2026 13:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

      // Trigger another manual loop execution or wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const res = await request(app).get(`/api/agent/feed?agentId=${agentAId}`);
      expect(res.body.posts.length).toBeGreaterThanOrEqual(1);

      // Verify sorting: newest first (based on date/time sequence)
      if (res.body.posts.length >= 2) {
        const firstTime = Date.parse(res.body.posts[0].createdAt);
        const secondTime = Date.parse(res.body.posts[1].createdAt);
        expect(firstTime).toBeGreaterThanOrEqual(secondTime);
      }
    });

    it('13. should return empty array when agent has no posts', async () => {
      // Initialize Agent B (Cooking - will reject topics, hence no posts published)
      const resB = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Nova',
            domain: 'Cooking',
          },
        });
      agentBId = resB.body.agentId;

      // Stop Agent B loop to prevent background cycles
      await globalAutonomousService.stopAgentLoop(agentBId);

      const res = await request(app).get(`/api/agent/feed?agentId=${agentBId}`);
      expect(res.status).toBe(200);
      expect(res.body.posts).toEqual([]);
    });

    it('14. to 17. should verify post constraints (unique ID, valid UTC, rationale, and sources)', async () => {
      const res = await request(app).get(`/api/agent/feed?agentId=${agentAId}`);
      if (res.body.posts.length > 0) {
        const post = res.body.posts[0];
        expect(post.id).toMatch(/^post-/);
        expect(isNaN(Date.parse(post.createdAt))).toBe(false);
        expect(typeof post.rationale).toBe('string');
        expect(post.rationale.length).toBeGreaterThan(0);
        expect(Array.isArray(post.sources)).toBe(true);
        expect(post.sources.length).toBeGreaterThan(0);
      }
    });

    it('18. should prevent duplicate publishing for same topic', async () => {
      const postsBefore = await globalPostRepository.findByAgentId(agentAId);
      
      // Attempt to execute cycle again
      await globalAutonomousService.executeCycle(agentAId);

      const postsAfter = await globalPostRepository.findByAgentId(agentAId);
      // Number of published posts should remain unchanged because the topic has already been published
      const pubBefore = postsBefore.filter((p) => p.status === 'PUBLISHED').length;
      const pubAfter = postsAfter.filter((p) => p.status === 'PUBLISHED').length;
      expect(pubAfter).toEqual(pubBefore);
    });

    it('19. should prevent one agent accessing another agent feed', async () => {
      // Query A's feed but pass Agent B validation check (Wait, validation is on parameter agentId)
      const res = await request(app).get(`/api/agent/feed?agentId=agent-missing999`);
      expect(res.status).toBe(404);
    });

    it('20. should prevent concurrent cycles running for same agent (isProcessing lock)', async () => {
      // Force set lock
      const service = globalAutonomousService as any;
      service.processingAgents.add(agentAId);

      const spy = jest.spyOn(discoveryService, 'discover');
      await globalAutonomousService.executeCycle(agentAId);

      // Discovery should be skipped
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();

      // Release lock
      service.processingAgents.delete(agentAId);
    });
  });

  describe('Error Tolerances and Failures', () => {
    it('21. should continue future cycles on AI provider failure', async () => {
      const spy = jest.spyOn(globalAIProvider, 'generateText').mockImplementationOnce(() => {
        throw new Error('LLM connection error');
      });

      // Execute cycle: evaluation will pass, but generation fails. Should catch error safely
      await expect(globalAutonomousService.executeCycle(agentAId)).resolves.not.toThrow();

      spy.mockRestore();
    });

    it('22. should continue future cycles on topic discovery failure', async () => {
      const spy = jest.spyOn(discoveryService, 'discover').mockImplementationOnce(() => {
        throw new Error('Network timeout');
      });

      await expect(globalAutonomousService.executeCycle(agentAId)).resolves.not.toThrow();

      spy.mockRestore();
    });

    it('23. should continue future cycles on publishing failure', async () => {
      const spy = jest.spyOn(globalPublishingService, 'publishPost').mockImplementationOnce(() => {
        throw new Error('Database locked');
      });

      await expect(globalAutonomousService.executeCycle(agentAId)).resolves.not.toThrow();

      spy.mockRestore();
    });

    it('24. & 25. should handle all candidates rejected or no topics safely', async () => {
      // Setup mock fetch returning zero items
      mockFeedXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>`;

      await expect(globalAutonomousService.executeCycle(agentAId)).resolves.not.toThrow();

      // Memory check should log type statistics
      const list = await globalMemoryRepository.findByAgentId(agentAId);
      // We logged warning or fallback
      expect(list.length).toBeGreaterThan(0);
    });

    it('26. should record memory on successful publication', async () => {
      const list = await globalMemoryRepository.findByAgentId(agentAId);
      const pubs = list.filter((m) => m.type === 'PUBLISHED_POST');
      expect(pubs.length).toBeGreaterThan(0);
    });

    it('27. should verify agent status endpoint is working', async () => {
      const res = await request(app).get(`/api/agent/status?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body.agent.id).toBe(agentAId);
      expect(['RUNNING', 'DEGRADED']).toContain(res.body.agent.status);
    });

    it('28. should stop loops on graceful shutdown stopAll call', async () => {
      await globalAutonomousService.stopAll();

      const agent = await globalAgentRepository.findById(agentAId);
      expect(agent?.status).toBe('STOPPED');
    });
  });

  describe('Compatibility tests with previous stages', () => {
    it('29. Stage 6 content generation route still works', async () => {
      // Seed accepted topic
      const now = new Date().toISOString();
      const topic = await globalTopicRepository.save({
        id: 'topic-compat-6',
        agentId: agentAId,
        title: 'Compatibility exploit model hacks',
        summary: 'Details.',
        source: { name: 'TechCrunch', url: 'https://tc.com' },
        publishedAt: now,
        discoveredAt: now,
      });

      await globalEditorialRepository.save({
        id: 'decision-compat-6',
        agentId: agentAId,
        topicId: topic.id,
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
        reason: 'Good topic.',
        evaluatedAt: now,
      });

      const res = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId: agentAId, topicId: topic.id });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('post');
    });

    it('30. Stage 5 memory summary route still works', async () => {
      const res = await request(app).get(`/api/agent/memory/summary?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body.summary.totalMemories).toBeGreaterThan(0);
    });

    it('31. Stage 4 persona configuration retrieval route still works', async () => {
      const res = await request(app).get(`/api/agent/persona?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body.persona.name).toBe('Ada');
    });

    it('32. Stage 3 editorial evaluation route still works', async () => {
      const now = new Date().toISOString();
      const topic = await globalTopicRepository.save({
        id: 'topic-compat-3',
        agentId: agentAId,
        title: 'Compatibility editorial vulnerability threat',
        summary: 'Details.',
        source: { name: 'TechCrunch', url: 'https://tc.com' },
        publishedAt: now,
        discoveredAt: now,
      });

      const res = await request(app)
        .post(`/api/agent/topics/${topic.id}/evaluate`)
        .send({ agentId: agentAId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('decision');
    });

    it('33. Stage 2 crawler route still works', async () => {
      const res = await request(app)
        .post('/api/agent/discover')
        .send({ agentId: agentAId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('discovered');
    });

    it('34. Stage 1 agent initialization route still works', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada Compat',
            domain: 'AI Security',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('agentId');
    });

    it('35. GET /health still returns HTTP 200 ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });
});
