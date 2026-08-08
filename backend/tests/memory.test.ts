import request from 'supertest';
import app from '../src/server';
import { globalMemoryRepository } from '../src/repositories/memory.repository';
import { globalTopicRepository } from '../src/repositories/topic.repository';
import { normalizeText } from '../src/utils/textNormalizer';

describe('Memory Engine Endpoints & Integration', () => {
  let agentAId: string;
  let agentBId: string;
  let topicIdA: string;
  let originalFetch: typeof global.fetch;

  beforeAll(async () => {
    originalFetch = global.fetch;

    // Mock fetch for Stage 2 discovery pings
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Discovery Article 123</title>
      <link>https://example.com/discovered-item-1</link>
      <description>Live parsed description payload.</description>
      <pubDate>Sat, 08 Aug 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`),
      } as Response)
    );

    // 1. Initialize Agent A
    const resA = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada',
          domain: 'AI Security',
        },
      });
    agentAId = resA.body.agentId;

    // 2. Initialize Agent B
    const resB = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Nova',
          domain: 'Cooking',
        },
      });
    agentBId = resB.body.agentId;

    // 3. Seed topics manually
    const now = new Date().toISOString();
    const topicA = await globalTopicRepository.save({
      id: 'topic-mem1',
      agentId: agentAId,
      title: 'Vulnerability exploit in prompt injects',
      summary: 'Critical vulnerability discovered in conversational prompts.',
      source: { name: 'TechCrunch', url: 'https://tc.com/exploit1' },
      publishedAt: now,
      discoveredAt: now,
    });
    topicIdA = topicA.id;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('Text Normalization Helper (normalizeText)', () => {
    it('should strip punctuation, lowercase, and filter stopwords correctly', () => {
      const text = 'OpenAI launches a new reasoning model!';
      const normalized = normalizeText(text);
      // 'OpenAI', 'launches', 'new', 'reasoning', 'model' (removes 'a')
      expect(normalized).toBe('openai launches new reasoning model');
    });
  });

  describe('Memory Repository and Storage Operations', () => {
    it('1. should create a memory record successfully', async () => {
      const now = new Date().toISOString();
      const mem = await globalMemoryRepository.save({
        id: 'mem-custom1',
        agentId: agentAId,
        type: 'DISCOVERED_TOPIC',
        topicId: 'topic-custom1',
        title: 'Custom Topic Title',
        summary: 'Bio summary details.',
        source: 'https://custom.com',
        createdAt: now,
      });

      expect(mem.id).toBe('mem-custom1');
      expect(mem.agentId).toBe(agentAId);
    });

    it('2. should retrieve memory records for an agent', async () => {
      const memories = await globalMemoryRepository.findByAgentId(agentAId);
      expect(memories.length).toBeGreaterThan(0);
      expect(memories.some((m) => m.id === 'mem-custom1')).toBe(true);
    });

    it('3. should verify memory record belongs to correct agent', async () => {
      const memories = await globalMemoryRepository.findByAgentId(agentAId);
      const m = memories.find((x) => x.id === 'mem-custom1');
      expect(m?.agentId).toBe(agentAId);
    });

    it('4. should prevent Agent A accessing Agent B memory (via endpoints)', async () => {
      // Create memory for B
      await globalMemoryRepository.save({
        id: 'mem-agentB-private',
        agentId: agentBId,
        type: 'DISCOVERED_TOPIC',
        topicId: 'topic-b1',
        title: 'Baking a loaf of bread',
        summary: 'Recipes for bread baking.',
        source: 'https://bread.com',
        createdAt: new Date().toISOString(),
      });

      // Get agent A history and verify B's memory is NOT visible
      const res = await request(app).get(`/api/agent/memory?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      const foundBMemory = res.body.memories.some((m: any) => m.id === 'mem-agentB-private');
      expect(foundBMemory).toBe(false);
    });
  });

  describe('Recording and Heuristic Duplicate Detection Checks', () => {
    it('5. should record topic discovery memory', async () => {
      // Discover Endpoint will trigger discovery and record
      const res = await request(app)
        .post('/api/agent/discover')
        .send({ agentId: agentAId });

      expect(res.status).toBe(200);

      // Verify that a DISCOVERED_TOPIC memory was created
      const list = await globalMemoryRepository.findByAgentId(agentAId);
      const discoveries = list.filter((m) => m.type === 'DISCOVERED_TOPIC');
      expect(discoveries.length).toBeGreaterThan(0);
    });

    it('6. should record editorial decision memory', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topicIdA}/evaluate`)
        .send({ agentId: agentAId });

      expect(res.status).toBe(200);

      // Verify that an ACCEPTED_TOPIC or REJECTED_TOPIC memory was recorded
      const list = await globalMemoryRepository.findByAgentId(agentAId);
      const evaluations = list.filter((m) => m.type === 'ACCEPTED_TOPIC' || m.type === 'REJECTED_TOPIC');
      expect(evaluations.length).toBeGreaterThan(0);
      expect(evaluations.some((m) => m.topicId === topicIdA)).toBe(true);
    });

    it('7. should check exact topic match', async () => {
      // Check exact ID match
      const checkRes = await request(app)
        .post('/api/agent/memory/check')
        .send({ agentId: agentAId, topicId: topicIdA });

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.memory.isKnown).toBe(true);
      expect(checkRes.body.memory.matchType).toBe('EXACT_TOPIC_ID');
    });

    it('8. should check normalized title match', async () => {
      // Seed a topic with title matching normalized title of topicA
      const now = new Date().toISOString();
      const topicNorm = await globalTopicRepository.save({
        id: 'topic-norm-match-title',
        agentId: agentAId,
        title: 'Vulnerability exploit in prompt injects!!!', // Slightly different punctuation
        summary: 'Different summary content.',
        source: { name: 'TechCrunch', url: 'https://different-source.com' },
        publishedAt: now,
        discoveredAt: now,
      });

      const checkRes = await request(app)
        .post('/api/agent/memory/check')
        .send({ agentId: agentAId, topicId: topicNorm.id });

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.memory.isKnown).toBe(true);
      // Matches the existing decision title of topicIdA ('Vulnerability exploit in prompt injects')
      expect(checkRes.body.memory.matchType).toBe('NORMALIZED_TITLE');
    });

    it('9. should return isKnown: false for unknown topic', async () => {
      const now = new Date().toISOString();
      const topicUnknown = await globalTopicRepository.save({
        id: 'topic-unknown-random',
        agentId: agentAId,
        title: 'Baking a blueberry muffin',
        summary: 'Recipes to bake simple muffins.',
        source: { name: 'TechCrunch', url: 'https://tc.com/muffins' },
        publishedAt: now,
        discoveredAt: now,
      });

      const checkRes = await request(app)
        .post('/api/agent/memory/check')
        .send({ agentId: agentAId, topicId: topicUnknown.id });

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.memory.isKnown).toBe(false);
    });

    it('13. should prevent duplicate memory creation for identical topic pings', async () => {
      const now = new Date().toISOString();
      const dupTopic = {
        id: 'topic-dup-test',
        agentId: agentAId,
        title: 'Unique Duplicate Test Title',
        summary: 'Summary text.',
        source: { name: 'TechCrunch', url: 'https://tc.com/dup' },
        publishedAt: now,
        discoveredAt: now,
      };

      // Import memory controller instance
      const { memoryService } = require('../src/controllers/memory.controller');

      // Record first discovery
      const mem1 = await memoryService.recordTopicDiscovery(agentAId, dupTopic);
      // Record second discovery
      const mem2 = await memoryService.recordTopicDiscovery(agentAId, dupTopic);

      expect(mem1.id).toEqual(mem2.id); // Reused identical ID
    });
  });

  describe('Memory API Endpoints Checks', () => {
    it('10. should check memory endpoint validations', async () => {
      const res = await request(app)
        .post('/api/agent/memory/check')
        .send({});
      expect(res.status).toBe(400);

      const res2 = await request(app)
        .post('/api/agent/memory/check')
        .send({ agentId: 'agent-nonexistent999', topicId: topicIdA });
      expect(res2.status).toBe(404);
    });

    it('11. should check memory history endpoint', async () => {
      const res = await request(app).get(`/api/agent/memory?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('memories');
      expect(Array.isArray(res.body.memories)).toBe(true);
    });

    it('12. should check memory summary endpoint returns correct statistics', async () => {
      const res = await request(app).get(`/api/agent/memory/summary?agentId=${agentAId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('totalMemories');
      expect(res.body.summary).toHaveProperty('topicsDiscovered');
      expect(res.body.summary).toHaveProperty('topicsEvaluated');
      expect(res.body.summary).toHaveProperty('acceptedTopics');
      expect(res.body.summary).toHaveProperty('rejectedTopics');
    });
  });

  describe('Backwards Compatibility checks', () => {
    it('16. Stage 3 evaluation route still works', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topicIdA}/evaluate`)
        .send({ agentId: agentAId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('decision');
    });

    it('17. Stage 2 discovery route still works', async () => {
      const res = await request(app)
        .post('/api/agent/discover')
        .send({ agentId: agentAId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('discovered');
    });

    it('18. Stage 1 agent initialization route still works', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Nova',
            domain: 'AI Agents',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('agentId');
    });

    it('19. GET /health still works', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });
});
