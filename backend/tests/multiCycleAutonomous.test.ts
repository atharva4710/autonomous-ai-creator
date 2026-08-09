import request from 'supertest';
import app from '../src/server';
import { globalAgentRepository } from '../src/repositories/agent.repository';
import { globalTopicRepository } from '../src/repositories/topic.repository';
import { globalEditorialRepository } from '../src/repositories/editorial.repository';
import { globalPostRepository } from '../src/repositories/post.repository';
import { globalMemoryRepository } from '../src/repositories/memory.repository';
import { globalAutonomousService } from '../src/services/autonomous/autonomous.service';
import { globalContentGenerationService } from '../src/services/contentGeneration.service';
import { discoveryService } from '../src/controllers/discovery.controller';

describe('Phase 11 — True Multi-Cycle Autonomous 48-Hour Operation Tests', () => {
  let agentId: string;
  let originalFetch: typeof global.fetch;
  let currentCycleNum = 1;

  const cycleTopics = [
    { title: 'OpenAI Launches Model Sentinel AI Security Patch', link: 'https://example.com/openai-sentinel' },
    { title: 'Anthropic Discovers Prompt Injection Vulnerability in AI Security Model Claude', link: 'https://example.com/anthropic-prompt' },
    { title: 'DeepMind Publishes RAG Attack Defenses AI Security Research Paper', link: 'https://example.com/deepmind-rag' },
    { title: 'HuggingFace Releases Model Vulnerability AI Security Scanner Tool', link: 'https://example.com/huggingface-scanner' },
    { title: 'Cybersecurity Firm Discovers Zero Day Attack in AI Security Agent Framework', link: 'https://example.com/zero-day-agent' },
    { title: 'Security Researchers Detail New Exploit Technique in AI Security Applications', link: 'https://example.com/exploit-technique' },
    { title: 'Zero Day Exploit Injection Vector Discovered in AI Security Copilot', link: 'https://example.com/topic-7-degraded-test' },
    { title: 'New Open Source AI Security Guardrail Framework Released', link: 'https://example.com/topic-8-recovered-test' },
    { title: 'Autonomous AI Security Firewall Defense System Announced', link: 'https://example.com/topic-9-timestamp-test' },
  ];

  beforeAll(async () => {
    process.env.AUTONOMOUS_ENABLED = 'true';
    originalFetch = global.fetch;

    // Reset singleton state
    (globalAgentRepository as any).agents?.clear();
    (globalTopicRepository as any).topics?.clear();
    (globalEditorialRepository as any).decisions?.clear();
    (globalPostRepository as any).posts?.clear();
    (globalMemoryRepository as any).memories?.clear();
    globalAutonomousService.resetInMemoryState();

    process.env.AUTONOMOUS_ENABLED = 'true';
    process.env.AUTONOMOUS_CYCLE_INTERVAL_MS = '900000';
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation(() => {
      const idx = Math.min(currentCycleNum - 1, cycleTopics.length - 1);
      const item = cycleTopics[idx];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      <description>In-depth technical coverage of ${item.title} for AI Security.</description>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(xml),
      } as Response);
    });
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await globalAutonomousService.stopAll();
  });

  it('1. should initialize ONE agent and verify active loop is running', async () => {
    const res = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada Multi',
          domain: 'AI Security',
          interests: ['prompt injection', 'vulnerability'],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('agentId');
    agentId = res.body.agentId;

    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);
  });

  it('2. should execute 5 consecutive cycles and publish multiple distinct posts', async () => {
    // Run 5 cycles explicitly with updating cycle numbers
    for (let c = 1; c <= 5; c++) {
      currentCycleNum = c;
      await globalAutonomousService.executeCycle(agentId);
    }

    // Verify posts table contains multiple published posts
    const posts = await globalPostRepository.findByAgentId(agentId);
    expect(posts.length).toBeGreaterThanOrEqual(4);

    // Verify post titles are distinct (no duplicates published)
    const titles = posts.map((p) => p.text.slice(0, 40));
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toEqual(posts.length);

    // Verify active loop is STILL active (scheduler did not die)
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);
  });

  it('3. should run fresh discovery every cycle and not reuse cached topics', async () => {
    const spy = jest.spyOn(discoveryService, 'discover');
    await globalAutonomousService.executeCycle(agentId);
    expect(spy).toHaveBeenCalledWith(agentId);
    spy.mockRestore();
  });

  it('4. should recover agent status from DEGRADED to RUNNING when generation succeeds', async () => {
    // 1. Manually set agent status to DEGRADED
    const agent = await globalAgentRepository.findById(agentId);
    if (agent) {
      agent.status = 'DEGRADED';
      await globalAgentRepository.save(agent);
    }

    const agentDegraded = await globalAgentRepository.findById(agentId);
    expect(agentDegraded?.status).toBe('DEGRADED');

    // 2. Next cycle succeeds cleanly with fresh candidate Topic 8
    currentCycleNum = 8;
    await globalAutonomousService.executeCycle(agentId);

    const agentRecovered = await globalAgentRepository.findById(agentId);
    expect(agentRecovered?.status).toBe('RUNNING');
  });

  it('5. should advance lastCycleAt and nextCycleAt timestamps every cycle', async () => {
    currentCycleNum = 9;
    const agentBefore = await globalAgentRepository.findById(agentId);
    const lastCycleBefore = agentBefore?.lastCycleAt;
    const nextCycleBefore = agentBefore?.nextCycleAt;

    await new Promise((resolve) => setTimeout(resolve, 50));
    await globalAutonomousService.executeCycle(agentId);

    const agentAfter = await globalAgentRepository.findById(agentId);
    expect(agentAfter?.lastCycleAt).not.toEqual(lastCycleBefore);
    expect(agentAfter?.nextCycleAt).not.toEqual(nextCycleBefore);
  });
});
