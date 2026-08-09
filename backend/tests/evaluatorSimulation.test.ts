process.env.AUTONOMOUS_CYCLE_INTERVAL_MS = '500';
process.env.AUTONOMOUS_ENABLED = 'true';
process.env.STRICT_DOMAIN_CHECK = 'true';

// 1. Back up and mock global fetch at the very top of the file before imports
const originalFetch = global.fetch;
const originalGlobalThisFetch = globalThis.fetch;

const compliantXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Mock Tech Feed</title>
    <link>https://example.com</link>
    <description>Mock Feed Description</description>
    <item>
      <title>Critical LLM security vulnerability and prompt injection exploit in AI agents</title>
      <link>https://news.ycombinator.com/item?id=123</link>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description>A prompt injection zero-day exploit exposes critical LLM vulnerabilities in AI agents frameworks, affecting machine learning safety and AI privacy.</description>
    </item>
  </channel>
</rss>`;

global.fetch = (async (url: any) => {
  return {
    ok: true,
    text: () => Promise.resolve(compliantXml),
  };
}) as any;
globalThis.fetch = global.fetch;

import request from 'supertest';
import app from '../src/server';
import { globalAgentRepository } from '../src/repositories/agent.repository';
import { globalTopicRepository } from '../src/repositories/topic.repository';
import { globalPostRepository } from '../src/repositories/post.repository';
import { globalAutonomousService } from '../src/services/autonomous/autonomous.service';
import { globalEditorialRepository } from '../src/repositories/editorial.repository';
import { globalMemoryRepository } from '../src/repositories/memory.repository';

describe('Organizer Evaluator Compliance Simulation', () => {
  let agentId: string;

  beforeAll(async () => {
    // Stop all loops first
    const agents = await globalAgentRepository.findAll();
    for (const a of agents) {
      await globalAutonomousService.stopAgentLoop(a.agentId);
    }
    await globalAutonomousService.stopAll();

    // Clean all in-memory repositories to ensure a clean slate
    (globalAgentRepository as any).agents.clear();
    (globalTopicRepository as any).topics.clear();
    (globalEditorialRepository as any).decisions.clear();
    (globalPostRepository as any).posts.clear();
    (globalMemoryRepository as any).memories.clear();
  });

  afterAll(async () => {
    // Restore global fetch
    global.fetch = originalFetch;
    globalThis.fetch = originalGlobalThisFetch;

    // Stop loops first
    await globalAutonomousService.stopAll();

    // Wait for any active execution cycles to complete
    if (agentId) {
      while (globalAutonomousService.isProcessing(agentId)) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  });

  it('STEP 1 & 2: POST /api/agent/init accepts persona and returns agentId', async () => {
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
    agentId = res.body.agentId;
    expect(typeof agentId).toBe('string');
  });

  it('Init rejects invalid or non-AI/tech domains', async () => {
    const res = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Bob',
          domain: 'Sports News & Celebrity Gossip',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Persona domain must be AI or technology focused');
  });

  it('Repeated initialization returns existing agentId without creating duplicate loop', async () => {
    const res = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada',
          domain: 'AI Security',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.agentId).toBe(agentId);
  });

  it('Feed before first post returns empty array without crashing', async () => {
    const res = await request(app)
      .get(`/api/agent/feed?agentId=${agentId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ posts: expect.any(Array) });
  });

  it('STEP 3 & 4: Wait for autonomous system and verify GET /api/agent/feed?agentId=...', async () => {
    // Wait 2.5 seconds for loop cycles to run (cycle interval set to 500ms)
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const res = await request(app)
      .get(`/api/agent/feed?agentId=${agentId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('posts');
    expect(Array.isArray(res.body.posts)).toBe(true);
    expect(res.body.posts.length).toBeGreaterThan(0);

    const post = res.body.posts[0];
    // Verify required feed contract fields exist
    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('createdAt');
    expect(post).toHaveProperty('text');
    expect(post).toHaveProperty('rationale');
    expect(post).toHaveProperty('sources');

    // Verify ISO UTC timestamp format
    expect(new Date(post.createdAt).toISOString()).toBe(post.createdAt);

    // Verify sources reference actual topic URL
    expect(post.sources).toContain('https://news.ycombinator.com/item?id=123');

    // Verify rationale answers required compliance questions
    expect(post.rationale).toContain('Selected because');
    expect(post.rationale).toContain('aligns with');
    expect(post.rationale).toContain('relevant now');
    expect(post.rationale).toContain('valuable to the persona');
  });

  it('Multiple GET /feed calls are read-only and do not create duplicate posts', async () => {
    const res1 = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    const res2 = await request(app).get(`/api/agent/feed?agentId=${agentId}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.posts.length).toBe(res2.body.posts.length);
  });

  it('GET /feed rejects missing or invalid agentId gracefully', async () => {
    const resMissing = await request(app).get('/api/agent/feed');
    expect(resMissing.status).toBe(400);

    const resInvalid = await request(app).get('/api/agent/feed?agentId=agent-nonexistent999');
    expect(resInvalid.status).toBe(404);
  });

  it('Explanation endpoint returns post, topic, decision, and memory metadata', async () => {
    const feedRes = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    const postId = feedRes.body.posts[0].id;

    const expRes = await request(app).get(`/api/agent/posts/${postId}/explanation?agentId=${agentId}`);
    expect(expRes.status).toBe(200);
    expect(expRes.body).toHaveProperty('explanation');
    expect(expRes.body.explanation).toHaveProperty('post');
    expect(expRes.body.explanation).toHaveProperty('topic');
    expect(expRes.body.explanation).toHaveProperty('decision');
    expect(expRes.body.explanation).toHaveProperty('memory');
  });

  it('Activity latest endpoint returns structured latest activity event', async () => {
    const actRes = await request(app).get(`/api/agent/activity/latest?agentId=${agentId}`);
    expect(actRes.status).toBe(200);
    expect(actRes.body).toHaveProperty('latest');
    expect(actRes.body.latest).not.toBeNull();
    expect(actRes.body.latest).toHaveProperty('id');
    expect(actRes.body.latest).toHaveProperty('type');
  });
});
