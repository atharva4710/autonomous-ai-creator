import request from 'supertest';
import app from '../src/server';
import { globalTopicRepository as topicRepository } from '../src/repositories/topic.repository';

describe('Editorial Judgment Engine Endpoints', () => {
  let agent1Id: string;
  let agent2Id: string;
  let topic1Id: string;
  let topic2Id: string;
  let otherAgentTopicId: string;

  beforeAll(async () => {
    // 1. Initialize Agent 1 (Ada - AI Security focus)
    const resAgent1 = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada',
          domain: 'AI Security',
        },
      });
    agent1Id = resAgent1.body.agentId;

    // 2. Initialize Agent 2 (Nova - General Cooking focus to test low relevance rejection)
    const resAgent2 = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Nova',
          domain: 'Cooking Recipes',
        },
      });
    agent2Id = resAgent2.body.agentId;

    // 3. Seed topics manually into topicRepository
    const nowStr = new Date().toISOString();

    // High relevance topic for Agent 1 (Ada - AI Security focus)
    const topic1 = await topicRepository.save({
      id: 'topic-test1',
      agentId: agent1Id,
      title: 'New LLM security vulnerability threat identified',
      summary: 'Researchers identified critical exploits in conversation prompts.',
      source: { name: 'TechCrunch', url: 'https://tc.com/1' },
      publishedAt: nowStr,
      discoveredAt: nowStr,
    });
    topic1Id = topic1.id;

    // Low relevance topic for Agent 1 (Ada - AI Security focus)
    const topic2 = await topicRepository.save({
      id: 'topic-test2',
      agentId: agent1Id,
      title: 'Healthy salad recipe for dinner tonight',
      summary: 'Learn how to cook easy vegetables and green salads.',
      source: { name: 'TechCrunch', url: 'https://tc.com/2' },
      publishedAt: nowStr,
      discoveredAt: nowStr,
    });
    topic2Id = topic2.id;

    // Topic belonging to Agent 2
    const topicOther = await topicRepository.save({
      id: 'topic-testother',
      agentId: agent2Id,
      title: 'Baking chocolate chip cookies',
      summary: 'Secret recipes to bake the softest cookies.',
      source: { name: 'TechCrunch', url: 'https://tc.com/3' },
      publishedAt: nowStr,
      discoveredAt: nowStr,
    });
    otherAgentTopicId = topicOther.id;
  });

  describe('Single-Topic Evaluation (POST /api/agent/topics/:topicId/evaluate)', () => {
    it('should evaluate a high-relevance topic and ACCEPT it', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topic1Id}/evaluate`)
        .send({ agentId: agent1Id });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('decision');
      expect(res.body.decision.decision).toBe('ACCEPT');
      expect(res.body.decision.scores.overall).toBeGreaterThanOrEqual(65);
      expect(typeof res.body.decision.reason).toBe('string');
      expect(res.body.decision.reason).toContain('Highly relevant');
      expect(res.body.decision).toHaveProperty('evaluatedAt');
    });

    it('should evaluate a low-relevance topic and REJECT it', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topic2Id}/evaluate`)
        .send({ agentId: agent1Id });

      expect(res.status).toBe(200);
      expect(res.body.decision.decision).toBe('REJECT');
      expect(res.body.decision.scores.overall).toBeLessThan(65);
      expect(res.body.decision.reason).toContain('did not meet the required threshold');
    });

    it('should maintain all calculated score criteria within 0-100 bounds', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topic1Id}/evaluate`)
        .send({ agentId: agent1Id });

      const scores = res.body.decision.scores;
      for (const key of Object.keys(scores)) {
        expect(scores[key]).toBeGreaterThanOrEqual(0);
        expect(scores[key]).toBeLessThanOrEqual(100);
      }
    });

    it('should calculate the overall score using correct weighting values', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topic1Id}/evaluate`)
        .send({ agentId: agent1Id });

      const s = res.body.decision.scores;
      // overall = relevance * 0.25 + alignment * 0.20 + timeliness * 0.15 + importance * 0.15 + novelty * 0.15 + quality * 0.10
      const expectedOverall = Math.round(
        s.relevance * 0.25 +
        s.personaAlignment * 0.20 +
        s.timeliness * 0.15 +
        s.importance * 0.15 +
        s.novelty * 0.15 +
        s.sourceQuality * 0.10
      );

      expect(s.overall).toBe(expectedOverall);
    });

    it('should fail with HTTP 400 when agentId is missing in request body', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topic1Id}/evaluate`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should fail with HTTP 404 when agentId does not exist', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${topic1Id}/evaluate`)
        .send({ agentId: 'agent-nonexistent999' });

      expect(res.status).toBe(404);
    });

    it('should fail with HTTP 404 when topicId does not exist', async () => {
      const res = await request(app)
        .post('/api/agent/topics/topic-nonexistent999/evaluate')
        .send({ agentId: agent1Id });

      expect(res.status).toBe(404);
    });

    it('should fail with HTTP 403 when topic belongs to another agent persona', async () => {
      const res = await request(app)
        .post(`/api/agent/topics/${otherAgentTopicId}/evaluate`)
        .send({ agentId: agent1Id });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('belong to the specified agent');
    });

    it('should return the existing cached decision on repeat evaluation requests', async () => {
      // 1st call
      const res1 = await request(app)
        .post(`/api/agent/topics/${topic1Id}/evaluate`)
        .send({ agentId: agent1Id });

      const decisionId1 = res1.body.decision.id;

      // 2nd call
      const res2 = await request(app)
        .post(`/api/agent/topics/${topic1Id}/evaluate`)
        .send({ agentId: agent1Id });

      const decisionId2 = res2.body.decision.id;

      expect(decisionId1).toEqual(decisionId2);
    });
  });

  describe('Bulk Evaluation (POST /api/agent/topics/evaluate)', () => {
    it('should perform bulk evaluation of all agent topics successfully', async () => {
      const res = await request(app)
        .post('/api/agent/topics/evaluate')
        .send({ agentId: agent1Id });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('evaluated');
      expect(res.body).toHaveProperty('accepted');
      expect(res.body).toHaveProperty('rejected');
      expect(res.body).toHaveProperty('decisions');
      expect(Array.isArray(res.body.decisions)).toBe(true);
      expect(res.body.evaluated).toBe(2); // topic1 and topic2
      expect(res.body.accepted).toBe(1); // topic1 accepted
      expect(res.body.rejected).toBe(1); // topic2 rejected
    });

    it('should fail with HTTP 400 when agentId is missing in bulk body', async () => {
      const res = await request(app)
        .post('/api/agent/topics/evaluate')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should fail with HTTP 404 when non-existent agentId is provided in bulk body', async () => {
      const res = await request(app)
        .post('/api/agent/topics/evaluate')
        .send({ agentId: 'agent-nonexistent999' });

      expect(res.status).toBe(404);
    });
  });

  describe('Previous Stage compatibility checks', () => {
    it('GET /health should still return HTTP 200 "ok"', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('POST /api/agent/init should still successfully create new agent', async () => {
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
  });
});
