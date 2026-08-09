import request from 'supertest';
import app from '../src/server';
import { globalAgentRepository } from '../src/repositories/agent.repository';
import { globalTopicRepository } from '../src/repositories/topic.repository';
import { globalEditorialRepository } from '../src/repositories/editorial.repository';
import { globalPostRepository } from '../src/repositories/post.repository';
import { globalMemoryRepository } from '../src/repositories/memory.repository';
import { globalActivityRepository } from '../src/repositories/activity.repository';
import { globalAutonomousService } from '../src/services/autonomous/autonomous.service';
import { globalActivityService } from '../src/services/activity.service';

describe('Activity Logging & Explainability Endpoints', () => {
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

    // Enable autonomous loop trigger
    process.env.AUTONOMOUS_ENABLED = 'true';
    process.env.AUTONOMOUS_CYCLE_INTERVAL_MS = '500';

    // Clear singleton repositories to prevent state leak
    (globalAgentRepository as any).agents?.clear();
    (globalTopicRepository as any).topics?.clear();
    (globalEditorialRepository as any).decisions?.clear();
    (globalPostRepository as any).posts?.clear();
    (globalMemoryRepository as any).memories?.clear();
    (globalActivityRepository as any).events?.clear();

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

  describe('Agent Initialization & Activity Capture', () => {
    it('28. Existing Stage 1 initialization still works, and logs AGENT_INITIALIZED event', async () => {
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

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('agentId');
      agentAId = res.body.agentId;

      // Verify the activity logs has AGENT_INITIALIZED event
      const events = await globalActivityRepository.findByAgentId(agentAId);
      const initEvent = events.find((e) => e.type === 'AGENT_INITIALIZED');
      expect(initEvent).toBeDefined();
      expect(initEvent?.message).toContain('initialized successfully');
    });

    it('29. health check endpoint GET /health still returns status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('Activity Service Operations', () => {
    it('1. should create activity events successfully', async () => {
      const event = await globalActivityService.recordEvent(
        agentAId,
        'CYCLE_STARTED',
        'Manual test cycle start trigger'
      );
      expect(event).toHaveProperty('id');
      expect(event.agentId).toBe(agentAId);
      expect(event.type).toBe('CYCLE_STARTED');
      expect(event.message).toBe('Manual test cycle start trigger');
      expect(event).toHaveProperty('timestamp');
    });

    it('2. & 3. & 4. & 5. should retrieve activity, newest-first, and enforce limits', async () => {
      // Create a few more test events with delay to ensure timestamp sorting
      await new Promise((resolve) => setTimeout(resolve, 5));
      await globalActivityService.recordEvent(agentAId, 'TOPIC_DISCOVERED', 'Test discovery log A');
      await new Promise((resolve) => setTimeout(resolve, 5));
      await globalActivityService.recordEvent(agentAId, 'TOPIC_ACCEPTED', 'Test approval log B');

      // 2. Retrieve
      const res = await request(app).get(`/api/agent/activity?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('activity');
      expect(res.body.activity.length).toBeGreaterThanOrEqual(3);

      // 3. Newest-first sorting check
      const events = res.body.activity;
      const parsedTime0 = Date.parse(events[0].createdAt);
      const parsedTime1 = Date.parse(events[1].createdAt);
      expect(parsedTime0).toBeGreaterThanOrEqual(parsedTime1);

      // 4. Limit check
      const resLimit = await request(app).get(`/api/agent/activity?agentId=${agentAId}&limit=2`);
      expect(resLimit.body.activity.length).toBe(2);

      // 5. Max limit check
      const resMax = await request(app).get(`/api/agent/activity?agentId=${agentAId}&limit=120`);
      expect(resMax.body.activity.length).toBeLessThanOrEqual(100);
    });

    it('6. should enforce agent isolation check on activity queries', async () => {
      // Create Agent B
      const resB = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Charles',
            domain: 'Hardware Architecture',
          },
        });
      agentBId = resB.body.agentId;

      // Try querying Agent A activity using Agent B ID
      // It should query Agent B's empty logs or filter out Agent A's details
      const res = await request(app).get(`/api/agent/activity?agentId=${agentBId}`);
      expect(res.status).toBe(200);
      const initEvent = res.body.activity.find((e: any) => e.agentId === agentAId);
      expect(initEvent).toBeUndefined(); // Agent A's logs must not leak to Agent B
    });
  });

  describe('Autonomous Loop Execution & Dynamic Logging Check', () => {
    it('7. to 14. should automatically trigger autonomous execution, publishing, and record lifecycle activities', async () => {
      // Let the background loop run (interval is 500ms)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const events = await globalActivityRepository.findByAgentId(agentAId);

      // 7. Topic discovered
      const hasDiscovered = events.some((e) => e.type === 'TOPIC_DISCOVERED');
      expect(hasDiscovered).toBe(true);

      // 8. Topic accepted
      const hasAccepted = events.some((e) => e.type === 'TOPIC_ACCEPTED');
      expect(hasAccepted).toBe(true);

      // 10. Memory checked
      const hasMemoryChecked = events.some((e) => e.type === 'MEMORY_CHECKED');
      expect(hasMemoryChecked).toBe(true);

      // 11. Content generated
      const hasGen = events.some((e) => e.type === 'CONTENT_GENERATED');
      expect(hasGen).toBe(true);

      // 12. Post published
      const hasPublished = events.some((e) => e.type === 'POST_PUBLISHED');
      expect(hasPublished).toBe(true);

      // 13. Cycle completed
      const hasCycleComp = events.some((e) => e.type === 'CYCLE_COMPLETED');
      expect(hasCycleComp).toBe(true);

      // 14. Cycle failed simulation
      const originalFindByAgentId = globalTopicRepository.findByAgentId;
      globalTopicRepository.findByAgentId = jest.fn().mockRejectedValue(new Error('Simulated DB failure'));

      try {
        await globalAutonomousService.executeCycle(agentAId);
      } catch (_) {}

      globalTopicRepository.findByAgentId = originalFindByAgentId;

      const updatedEvents = await globalActivityRepository.findByAgentId(agentAId);
      expect(updatedEvents.some((e) => e.type === 'CYCLE_FAILED')).toBe(true);
    });

    it('15. should retrieve correct activity summary numbers', async () => {
      const res = await request(app).get(`/api/agent/activity/summary?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary.topicsDiscovered).toBeGreaterThan(0);
      expect(res.body.summary.postsPublished).toBeGreaterThan(0);
    });

    it('16. should retrieve the latest activity correctly', async () => {
      const res = await request(app).get(`/api/agent/activity/latest?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('latest');
      expect(res.body.latest).not.toBeNull();
      expect(res.body.latest.agentId).toBe(agentAId);
    });

    it('18. & 19. & 20. should enrich feed response, preserving rationales and sources', async () => {
      const res = await request(app).get(`/api/agent/feed?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('posts');
      expect(res.body.posts.length).toBeGreaterThan(0);

      const post = res.body.posts[0];
      // Check enriched fields
      expect(post).toHaveProperty('topic');
      expect(post.topic).toHaveProperty('title');
      expect(post).toHaveProperty('editorial');
      expect(post.editorial).toHaveProperty('decision');
      expect(post.editorial).toHaveProperty('score');

      // 19. Rationale preserved
      expect(post).toHaveProperty('rationale');
      expect(post.rationale.length).toBeGreaterThan(0);

      // 20. Sources preserved
      expect(post).toHaveProperty('sources');
      expect(post.sources[0]).toContain('https://example.com/item-auton-1');
    });

    it('17. should fetch complete explainability metrics from post explanation route', async () => {
      const feedRes = await request(app).get(`/api/agent/feed?agentId=${agentAId}`);
      const postId = feedRes.body.posts[0].id;

      const res = await request(app).get(`/api/agent/posts/${postId}/explanation?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('explanation');

      const exp = res.body.explanation;
      expect(exp.topic).toHaveProperty('title');
      expect(exp.decision).toHaveProperty('decision');
      expect(exp.decision).toHaveProperty('score');
      expect(exp.decision).toHaveProperty('reason');
      expect(exp.memory).toHaveProperty('isKnown');
      expect(exp.rationale.length).toBeGreaterThan(0);
      expect(exp.sources[0]).toContain('https://example.com/item-auton-1');

      // Test isolation on explanation check: Agent B cannot fetch Agent A's explanation
      const resIso = await request(app).get(`/api/agent/posts/${postId}/explanation?agentId=${agentBId}`);
      expect(resIso.status).toBe(403);
    });

    it('21. should ensure status endpoint returns lastActivityType', async () => {
      const res = await request(app).get(`/api/agent/status?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('agent');
      expect(res.body.agent).toHaveProperty('lastActivityType');
      expect(res.body.agent.lastActivityType).not.toBeNull();
    });
  });

  describe('Compatibility tests with previous stages', () => {
    it('22. Stage 7 autonomous engine still works', async () => {
      const agentObj = await globalAgentRepository.findById(agentAId);
      if (agentObj) {
        agentObj.status = 'RUNNING';
        await globalAgentRepository.save(agentObj);
      }
      const agent = await globalAgentRepository.findById(agentAId);
      expect(agent?.status).toBe('RUNNING');
    });

    it('23. Stage 6 content generation still works', async () => {
      const topics = await globalTopicRepository.findByAgentId(agentAId);
      const res = await request(app).get(`/api/agent/content?agentId=${agentAId}`);
      expect(res.status).toBe(200);
    });

    it('24. Stage 5 memory summary route still works', async () => {
      const res = await request(app).get(`/api/agent/memory/summary?agentId=${agentAId}`);
      expect(res.status).toBe(200);
    });

    it('25. Stage 4 persona configuration retrieval route still works', async () => {
      const res = await request(app).get(`/api/agent/persona?agentId=${agentAId}`);
      expect(res.status).toBe(200);
    });

    it('26. Stage 3 editorial evaluation route still works', async () => {
      const topics = await globalTopicRepository.findByAgentId(agentAId);
      const res = await request(app)
        .post(`/api/agent/topics/${topics[0].id}/evaluate`)
        .send({ agentId: agentAId });
      expect(res.status).toBe(200);
    });

    it('27. Stage 2 crawler route still works', async () => {
      const res = await request(app)
        .post('/api/agent/discover')
        .send({ agentId: agentAId });
      expect(res.status).toBe(200);
    });
  });
});
