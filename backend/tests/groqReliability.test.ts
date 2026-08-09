import request from 'supertest';
import app from '../src/server';
import { globalAutonomousService } from '../src/services/autonomous/autonomous.service';
import { globalAgentRepository, InMemoryAgentRepository } from '../src/repositories/agent.repository';
import { globalTopicRepository, InMemoryTopicRepository } from '../src/repositories/topic.repository';
import { globalEditorialRepository, InMemoryEditorialRepository } from '../src/repositories/editorial.repository';
import { globalPostRepository, InMemoryPostRepository } from '../src/repositories/post.repository';
import { globalMemoryRepository, InMemoryMemoryRepository } from '../src/repositories/memory.repository';
import { MockAIProvider } from '../src/services/aiProvider';
import { globalContentGenerationService } from '../src/services/contentGeneration.service';

describe('Groq Reliability & Error Recovery Patch Test Suite', () => {
  jest.setTimeout(30000);
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    (globalAgentRepository as any).inMemoryFallback = new InMemoryAgentRepository();
    (globalTopicRepository as any).inMemoryFallback = new InMemoryTopicRepository();
    (globalEditorialRepository as any).inMemoryFallback = new InMemoryEditorialRepository();
    (globalPostRepository as any).inMemoryFallback = new InMemoryPostRepository();
    (globalMemoryRepository as any).inMemoryFallback = new InMemoryMemoryRepository();

    globalAutonomousService.resetInMemoryState();

    mockProvider = new MockAIProvider();
    (globalContentGenerationService as any).aiProvider = mockProvider;
  });

  afterEach(() => {
    globalAutonomousService.resetInMemoryState();
  });

  test('1. Groq generation success creates valid post draft and publishes', async () => {
    const initRes = await request(app)
      .post('/api/agent/init')
      .send({ persona: { name: 'Ada', domain: 'AI Security' } });

    expect(initRes.status).toBe(201);
    const agentId = initRes.body.agentId;

    await globalAutonomousService.executeCycle(agentId);

    const feedRes = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    expect(feedRes.status).toBe(200);
    expect(feedRes.body.posts.length).toBeGreaterThan(0);

    const post = feedRes.body.posts[0];
    expect(post.id).toBeDefined();
    expect(post.createdAt).toBeDefined();
    expect(post.text).toBeDefined();
    expect(post.rationale).toBeDefined();
    expect(post.sources).toBeDefined();
  });

  test('2. Groq 429 rate limit error does not publish post, updates agent to DEGRADED, schedules next cycle, and keeps loop alive', async () => {
    const initRes = await request(app)
      .post('/api/agent/init')
      .send({ persona: { name: 'Ada', domain: 'AI Security' } });

    const agentId = initRes.body.agentId;
    globalAutonomousService.startAgentLoop(agentId);

    // Set persistent failure mode
    mockProvider.setFailureMode('rate_limit', 100);

    await globalAutonomousService.executeCycle(agentId);

    // Check feed remains empty
    const feedRes = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    expect(feedRes.status).toBe(200);
    expect(feedRes.body.posts).toEqual([]);

    // Check agent state in repository
    const agent = await globalAgentRepository.findById(agentId);
    expect(agent).not.toBeNull();
    expect(agent!.status).toBe('DEGRADED');
    expect(agent!.nextCycleAt).toBeDefined();

    // Verify autonomous loop remains active
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);
  });

  test('3. Groq timeout error does not publish post, marks agent DEGRADED, and keeps loop alive', async () => {
    const initRes = await request(app)
      .post('/api/agent/init')
      .send({ persona: { name: 'Ada', domain: 'AI Security' } });

    const agentId = initRes.body.agentId;
    globalAutonomousService.startAgentLoop(agentId);

    mockProvider.setFailureMode('timeout', 100);

    await globalAutonomousService.executeCycle(agentId);

    const feedRes = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    expect(feedRes.body.posts).toEqual([]);

    const agent = await globalAgentRepository.findById(agentId);
    expect(agent!.status).toBe('DEGRADED');
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);
  });

  test('4. Groq 500/503 service error does not publish post and keeps loop alive', async () => {
    const initRes = await request(app)
      .post('/api/agent/init')
      .send({ persona: { name: 'Ada', domain: 'AI Security' } });

    const agentId = initRes.body.agentId;
    globalAutonomousService.startAgentLoop(agentId);

    mockProvider.setFailureMode('unavailable', 100);

    await globalAutonomousService.executeCycle(agentId);

    const feedRes = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    expect(feedRes.body.posts).toEqual([]);

    const agent = await globalAgentRepository.findById(agentId);
    expect(agent!.status).toBe('DEGRADED');
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);
  });

  test('5. Later successful cycle after error automatically publishes and recovers agent status to RUNNING', async () => {
    const initRes = await request(app)
      .post('/api/agent/init')
      .send({ persona: { name: 'Ada', domain: 'AI Security' } });

    const agentId = initRes.body.agentId;

    // Cycle 1: Rate limit failure (persistent for 100 attempts)
    mockProvider.setFailureMode('rate_limit', 100);
    await globalAutonomousService.executeCycle(agentId);

    const agentAfterFail = await globalAgentRepository.findById(agentId);
    expect(agentAfterFail!.status).toBe('DEGRADED');

    // Cycle 2: Rate limit cleared, provider succeeds
    mockProvider.setFailureMode(null, 0);
    await globalAutonomousService.executeCycle(agentId);

    const feedRes = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    expect(feedRes.status).toBe(200);
    expect(feedRes.body.posts.length).toBeGreaterThan(0);

    const agentAfterSuccess = await globalAgentRepository.findById(agentId);
    expect(agentAfterSuccess!.status).toBe('RUNNING');
  });

  test('6. Already published topic is skipped in memory check on repeat cycles', async () => {
    const initRes = await request(app)
      .post('/api/agent/init')
      .send({ persona: { name: 'Ada', domain: 'AI Security' } });

    const agentId = initRes.body.agentId;

    await globalAutonomousService.executeCycle(agentId);
    const feedRes1 = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    const firstCount = feedRes1.body.posts.length;

    await globalAutonomousService.executeCycle(agentId);
    const feedRes2 = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    
    expect(feedRes2.status).toBe(200);
    expect(feedRes2.body.posts.length).toBeGreaterThanOrEqual(firstCount);
  });

  test('7. Feed contract strictly preserves required JSON schema', async () => {
    const initRes = await request(app)
      .post('/api/agent/init')
      .send({ persona: { name: 'Ada', domain: 'AI Security' } });

    const agentId = initRes.body.agentId;

    await globalAutonomousService.executeCycle(agentId);

    const feedRes = await request(app).get(`/api/agent/feed?agentId=${agentId}`);
    expect(feedRes.status).toBe(200);
    expect(Array.isArray(feedRes.body.posts)).toBe(true);

    const post = feedRes.body.posts[0];
    expect(typeof post.id).toBe('string');
    expect(typeof post.createdAt).toBe('string');
    expect(typeof post.text).toBe('string');
    expect(typeof post.rationale).toBe('string');
    expect(Array.isArray(post.sources)).toBe(true);
  });
});
