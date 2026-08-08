import request from 'supertest';
import app from '../src/server';
import { globalTopicRepository } from '../src/repositories/topic.repository';

describe('Persona Engine Endpoints & Integration', () => {
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
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
      <title>Test Discovery Article</title>
      <link>https://example.com/item-1</link>
      <description>General tech news item description.</description>
      <pubDate>Sat, 08 Aug 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`),
      } as Response)
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('1. Initialize agent with basic persona', () => {
    it('should initialize successfully with name and domain, creating defaults', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('agentId');
    });
  });

  describe('2. Initialize agent with full persona', () => {
    it('should store and validate all provided fields', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            role: 'AI Security Analyst',
            domain: 'AI Security',
            description: 'Focuses on model hacks',
            interests: ['prompt injection', 'vulnerabilities'],
            expertise: ['machine learning'],
            tone: ['concise'],
            editorialPrinciples: ['evidence over hype'],
          },
        });

      expect(res.status).toBe(201);
      const agentId = res.body.agentId;

      const getRes = await request(app).get(`/api/agent/persona?agentId=${agentId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.persona.role).toBe('AI Security Analyst');
      expect(getRes.body.persona.interests).toEqual(['prompt injection', 'vulnerabilities']);
    });
  });

  describe('3. Default persona values', () => {
    it('should create domain-specific defaults for AI Security', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });
      const agentId = res.body.agentId;

      const getRes = await request(app).get(`/api/agent/persona?agentId=${agentId}`);
      expect(getRes.body.persona.role).toBe('AI Security Researcher');
      expect(getRes.body.persona.tone).toContain('analytical');
      expect(getRes.body.persona.interests).toContain('LLM security');
    });

    it('should create general defaults for other domains', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Gordon',
            domain: 'Cooking',
          },
        });
      const agentId = res.body.agentId;

      const getRes = await request(app).get(`/api/agent/persona?agentId=${agentId}`);
      expect(getRes.body.persona.role).toBe('Cooking Specialist');
      expect(getRes.body.persona.tone).toContain('professional');
    });
  });

  describe('4. Invalid persona name', () => {
    it('should reject empty or overly long name', async () => {
      const res1 = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: '',
            domain: 'AI Security',
          },
        });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'a'.repeat(150),
            domain: 'AI Security',
          },
        });
      expect(res2.status).toBe(400);
    });
  });

  describe('5. Invalid domain', () => {
    it('should reject empty or overly long domain', async () => {
      const res1 = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: '',
          },
        });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'd'.repeat(150),
          },
        });
      expect(res2.status).toBe(400);
    });
  });

  describe('6. Invalid interests', () => {
    it('should reject invalid interests format or oversize', async () => {
      const res1 = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
            interests: 'not-an-array',
          },
        });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
            interests: Array(20).fill('LLM safety'),
          },
        });
      expect(res2.status).toBe(400);
    });
  });

  describe('7. Invalid tone', () => {
    it('should reject invalid tone format or elements too long', async () => {
      const res1 = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
            tone: [true],
          },
        });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
            tone: ['t'.repeat(150)],
          },
        });
      expect(res2.status).toBe(400);
    });
  });

  describe('8. GET persona', () => {
    it('should retrieve persona context for valid agent ID', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });
      const agentId = res.body.agentId;

      const getRes = await request(app).get(`/api/agent/persona?agentId=${agentId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveProperty('persona');
      expect(getRes.body.persona.name).toBe('Ada');
    });

    it('should return HTTP 404 if agent does not exist', async () => {
      const getRes = await request(app).get('/api/agent/persona?agentId=agent-missing999');
      expect(getRes.status).toBe(404);
    });
  });

  describe('9. PATCH persona', () => {
    it('should successfully update valid persona parameters', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });
      const agentId = res.body.agentId;

      const patchRes = await request(app)
        .patch('/api/agent/persona')
        .send({
          agentId,
          persona: {
            role: 'Senior Cyber Officer',
            interests: ['hacking', 'firewalls'],
          },
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.persona.role).toBe('Senior Cyber Officer');
      expect(patchRes.body.persona.interests).toEqual(['hacking', 'firewalls']);
    });
  });

  describe('10. Partial persona update', () => {
    it('should only update the provided parameters, leaving others intact', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });
      const agentId = res.body.agentId;

      const patchRes = await request(app)
        .patch('/api/agent/persona')
        .send({
          agentId,
          persona: {
            description: 'Updated bio',
          },
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.persona.description).toBe('Updated bio');
      expect(patchRes.body.persona.role).toBe('AI Security Researcher'); // Default preserved
    });
  });

  describe('11. Cannot change agentId', () => {
    it('should ignore attempts to change agentId or reject arbitrary attributes', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });
      const agentId = res.body.agentId;

      const patchRes = await request(app)
        .patch('/api/agent/persona')
        .send({
          agentId,
          persona: {
            agentId: 'new-id-hack',
            databaseSecret: 'exploit',
          },
        });

      expect(patchRes.status).toBe(400); // Rejects unauthorized key databaseSecret
    });
  });

  describe('12. Persona persists after retrieval', () => {
    it('should remain updated on subsequent GET persona pings', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });
      const agentId = res.body.agentId;

      await request(app)
        .patch('/api/agent/persona')
        .send({
          agentId,
          persona: {
            role: 'Persisted Specialist',
          },
        });

      const getRes = await request(app).get(`/api/agent/persona?agentId=${agentId}`);
      expect(getRes.body.persona.role).toBe('Persisted Specialist');
    });
  });

  describe('Integration with Editorial & Topic Scoring', () => {
    let agentId: string;
    let topicId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
            interests: ['prompt injection', 'vulnerabilities'],
            expertise: ['machine learning', 'cybersecurity'],
            editorialPrinciples: ['Evidence over hype'],
          },
        });
      agentId = res.body.agentId;

      const now = new Date().toISOString();
      const topic = await globalTopicRepository.save({
        id: `topic-${crypto.randomUUID().slice(0, 8)}`,
        agentId,
        title: 'New prompt injection exploit discovered in LLM machine learning systems',
        summary: 'Researchers released a critical proof of concept showing vulnerabilities.',
        source: { name: 'TechCrunch', url: 'https://tc.com' },
        publishedAt: now,
        discoveredAt: now,
      });
      topicId = topic.id;
    });

    describe('13. Editorial engine receives persona context', () => {
      it('should successfully evaluate topic using persona variables', async () => {
        const res = await request(app)
          .post(`/api/agent/topics/${topicId}/evaluate`)
          .send({ agentId });

        expect(res.status).toBe(200);
        expect(res.body.decision.decision).toBe('ACCEPT');
      });
    });

    describe('14. Persona interests affect persona alignment', () => {
      it('should score high alignment for topics matching persona interests', async () => {
        const res = await request(app)
          .post(`/api/agent/topics/${topicId}/evaluate`)
          .send({ agentId });

        expect(res.body.decision.scores.personaAlignment).toBe(95); // High score
      });
    });

    describe('15. Expertise affects persona alignment', () => {
      it('should evaluate and score alignment based on expertise topics', async () => {
        // Change interests to general, keep machine learning expertise
        await request(app)
          .patch('/api/agent/persona')
          .send({
            agentId,
            persona: {
              interests: ['cooking'], // Unrelated interest
            },
          });

        const res = await request(app)
          .post(`/api/agent/topics/${topicId}/evaluate`)
          .send({ agentId });

        // Expertise includes machine learning, which is in the topic. So alignment matches
        expect(res.body.decision.scores.personaAlignment).toBeGreaterThanOrEqual(60);
      });
    });

    describe('16. Editorial principles affect reasoning', () => {
      it('should append principle justification to reasoning notes when speculative hype is found', async () => {
        // Seed speculative topic
        const now = new Date().toISOString();
        const speculativeTopic = await globalTopicRepository.save({
          id: `topic-${crypto.randomUUID().slice(0, 8)}`,
          agentId,
          title: 'AI will replace every software engineer next year in major disruption',
          summary: 'Speculative claims about the complete replacement of developers.',
          source: { name: 'TechCrunch', url: 'https://tc.com' },
          publishedAt: now,
          discoveredAt: now,
        });

        const res = await request(app)
          .post(`/api/agent/topics/${speculativeTopic.id}/evaluate`)
          .send({ agentId });

        expect(res.body.decision.reason).toContain('Speculative hype detected');
        expect(res.body.decision.reason).toContain('Evidence over hype');
      });
    });
  });

  describe('Compatibility tests', () => {
    it('17. Existing Stage 3 evaluation still works', async () => {
      const initRes = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });
      const agentId = initRes.body.agentId;

      const now = new Date().toISOString();
      const topic = await globalTopicRepository.save({
        id: `topic-${crypto.randomUUID().slice(0, 8)}`,
        agentId,
        title: 'New LLM security vulnerability threat identified',
        summary: 'Critical details on AI exploits.',
        source: { name: 'TechCrunch', url: 'https://tc.com' },
        publishedAt: now,
        discoveredAt: now,
      });

      const res = await request(app)
        .post(`/api/agent/topics/${topic.id}/evaluate`)
        .send({ agentId });

      expect(res.status).toBe(200);
      expect(res.body.decision.decision).toBe('ACCEPT');
    });

    it('18. Existing Stage 2 discovery still works', async () => {
      const initRes = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Ada',
            domain: 'AI Security',
          },
        });
      const agentId = initRes.body.agentId;

      const res = await request(app)
        .post('/api/agent/discover')
        .send({ agentId });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('discovered');
    });

    it('19. Existing Stage 1 initialization still works', async () => {
      const res = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Simple Ada',
            domain: 'AI Security',
          },
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('agentId');
    });

    it('20. /health still works', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });
});
