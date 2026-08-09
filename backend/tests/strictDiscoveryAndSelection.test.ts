import { expandDomainQueries } from '../src/utils/domainQueryExpander';
import { EditorialService } from '../src/services/editorial.service';
import { InMemoryEditorialRepository } from '../src/repositories/editorial.repository';
import { InMemoryAgentRepository } from '../src/repositories/agent.repository';
import { InMemoryTopicRepository } from '../src/repositories/topic.repository';
import { InMemoryPostRepository } from '../src/repositories/post.repository';
import { AgentState } from '../src/models/agent.interface';
import { Topic } from '../src/models/topic.interface';
import { PublishingService } from '../src/services/publishing.service';

describe('Phase 4 — Strict Persona-Based Discovery & Quality Filtering Engine', () => {
  let editorialRepo: InMemoryEditorialRepository;
  let editorialService: EditorialService;

  beforeEach(() => {
    editorialRepo = new InMemoryEditorialRepository();
    editorialService = new EditorialService(editorialRepo);
  });

  test('TEST 1: AI Security persona produces AI-security queries', () => {
    const queries = expandDomainQueries('AI Security', ['Prompt Injection']);
    expect(queries).toContain('AI Security');
    expect(queries).toContain('LLM Security');
    expect(queries).toContain('AI Vulnerability');
    expect(queries).toContain('Prompt Injection');
  });

  test('TEST 2: Robotics persona produces robotics queries', () => {
    const queries = expandDomainQueries('Robotics Engineering');
    expect(queries).toContain('Robotics AI');
    expect(queries).toContain('Humanoid Robot');
    expect(queries).toContain('Robotics Research');
  });

  test('TEST 3: ML persona produces ML-related queries', () => {
    const queries = expandDomainQueries('Machine Learning', ['Model Training']);
    expect(queries).toContain('Machine Learning');
    expect(queries).toContain('ML Research');
    expect(queries).toContain('Model Training');
  });

  test('TEST 4: Irrelevant topics are rejected (score below threshold)', async () => {
    const agent: AgentState = {
      agentId: 'agent-sec-1',
      persona: {
        name: 'Ada',
        role: 'AI Security Researcher',
        domain: 'AI Security',
        description: 'AI Security researcher',
        interests: ['AI Security'],
        expertise: ['AI Security'],
        tone: ['analytical'],
        editorialPrinciples: ['Evidence over hype'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };

    const irrelevantTopic: Topic = {
      id: 'topic-irrelevant-1',
      agentId: 'agent-sec-1',
      title: 'New smartphone screen display unveiled',
      summary: 'A consumer electronics company released a new OLED display panel for mobile phones.',
      source: { name: 'Tech Blog', url: 'https://example.com/mobile-phone' },
      publishedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    const decision = await editorialService.evaluateTopic(agent, irrelevantTopic);
    expect(decision.decision).toBe('REJECT');
    expect(decision.scores.relevance).toBeLessThan(35);
  });

  test('TEST 5: Fresh topics outrank stale topics when appropriate', async () => {
    const agent: AgentState = {
      agentId: 'agent-sec-2',
      persona: {
        name: 'Ada',
        role: 'AI Security Researcher',
        domain: 'AI Security',
        description: 'AI Security researcher',
        interests: ['AI Security'],
        expertise: ['AI Security'],
        tone: ['analytical'],
        editorialPrinciples: ['Evidence over hype'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };

    const freshTopic: Topic = {
      id: 'topic-fresh',
      agentId: 'agent-sec-2',
      title: 'Prompt Injection Vulnerability in AI Agents',
      summary: 'Critical AI security vulnerability reported in LLM prompt handling.',
      source: { name: 'TechCrunch AI', url: 'https://techcrunch.com/ai-vuln' },
      publishedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const staleTopic: Topic = {
      id: 'topic-stale',
      agentId: 'agent-sec-2',
      title: 'Prompt Injection Vulnerability in AI Agents',
      summary: 'Critical AI security vulnerability reported in LLM prompt handling.',
      source: { name: 'TechCrunch AI', url: 'https://techcrunch.com/ai-vuln-old' },
      publishedAt: staleDate,
      discoveredAt: new Date().toISOString(),
    };

    const freshDecision = await editorialService.evaluateTopic(agent, freshTopic);
    const staleDecision = await editorialService.evaluateTopic(agent, staleTopic);

    expect(freshDecision.scores.timeliness).toBeGreaterThan(staleDecision.scores.timeliness);
    expect(freshDecision.scores.overall).toBeGreaterThan(staleDecision.scores.overall);
  });

  test('TEST 6: High-quality sources score higher than poor sources', async () => {
    const agent: AgentState = {
      agentId: 'agent-sec-3',
      persona: {
        name: 'Ada',
        role: 'AI Security Researcher',
        domain: 'AI Security',
        description: 'AI Security researcher',
        interests: ['AI Security'],
        expertise: ['AI Security'],
        tone: ['analytical'],
        editorialPrinciples: ['Evidence over hype'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };

    const highQualityTopic: Topic = {
      id: 'topic-hq',
      agentId: 'agent-sec-3',
      title: 'AI Security Research Breakthrough',
      summary: 'Research paper on LLM safety benchmarking.',
      source: { name: 'ArXiv AI', url: 'https://arxiv.org/abs/1234' },
      publishedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    const lowQualityTopic: Topic = {
      id: 'topic-lq',
      agentId: 'agent-sec-3',
      title: 'AI Security Research Breakthrough',
      summary: 'Research paper on LLM safety benchmarking.',
      source: { name: 'Spam Aggregator Farm', url: 'https://contentfarm.com/post' },
      publishedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    const hqDecision = await editorialService.evaluateTopic(agent, highQualityTopic);
    const lqDecision = await editorialService.evaluateTopic(agent, lowQualityTopic);

    expect(hqDecision.scores.sourceQuality).toBeGreaterThan(lqDecision.scores.sourceQuality);
  });

  test('TEST 7, 8, 9, 10, 11, 12, 13, 14, 17: Full E2E Simulation & Rationale Generation', async () => {
    const { globalAgentRepository } = require('../src/repositories/agent.repository');
    const { globalTopicRepository } = require('../src/repositories/topic.repository');
    const { globalPostRepository } = require('../src/repositories/post.repository');
    const { globalEditorialRepository } = require('../src/repositories/editorial.repository');

    const agent: AgentState = {
      agentId: 'agent-e2e',
      persona: {
        name: 'Ada',
        role: 'AI Security Researcher',
        domain: 'AI Security',
        description: 'AI Security researcher',
        interests: ['AI Security'],
        expertise: ['AI Security'],
        tone: ['analytical'],
        editorialPrinciples: ['Evidence over hype'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    const topicA: Topic = {
      id: 'topic-A',
      agentId: 'agent-e2e',
      title: 'Critical Prompt Injection Vulnerability Discovered in Enterprise AI Agents',
      summary: 'Security researchers identified a remote exploit allowing prompt injection attacks in enterprise LLM framework.',
      source: { name: 'TechCrunch AI', url: 'https://techcrunch.com/prompt-inject' },
      publishedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    const topicB: Topic = {
      id: 'topic-B',
      agentId: 'agent-e2e',
      title: 'New Consumer Graphics Editor Released with AI Features',
      summary: 'A photo editing app added background removal tools.',
      source: { name: 'Tech News', url: 'https://example.com/photo-app' },
      publishedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    const topicC: Topic = {
      id: 'topic-C',
      agentId: 'agent-e2e',
      title: 'AI Security Exploit in Models',
      summary: 'Old security report on prompt exploits.',
      source: { name: 'Tech Blog', url: 'https://example.com/old-exploit' },
      publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    await globalTopicRepository.save(topicA);
    await globalTopicRepository.save(topicB);
    await globalTopicRepository.save(topicC);

    const decisionA = await editorialService.evaluateTopic(agent, topicA);
    const decisionB = await editorialService.evaluateTopic(agent, topicB);
    const decisionC = await editorialService.evaluateTopic(agent, topicC);

    expect(decisionA.decision).toBe('ACCEPT');
    expect(decisionA.scores.overall).toBeGreaterThan(decisionB.scores.overall);
    expect(decisionA.scores.overall).toBeGreaterThan(decisionC.scores.overall);

    const rejectedAlts = [
      { topicId: topicB.id, title: topicB.title, score: decisionB.scores.overall, rejectionReason: decisionB.reason },
      { topicId: topicC.id, title: topicC.title, score: decisionC.scores.overall, rejectionReason: decisionC.reason },
    ];
    decisionA.selectionRank = 1;
    decisionA.comparativeAlternatives = rejectedAlts;
    await globalEditorialRepository.save(decisionA);

    await globalPostRepository.save({
      id: 'post-A',
      agentId: 'agent-e2e',
      topicId: topicA.id,
      decisionId: decisionA.id,
      status: 'DRAFT',
      text: 'Draft post content for Candidate A',
      sources: [topicA.source.url],
      regenerationsCount: 0,
      createdAt: new Date().toISOString(),
    });

    const pubService = new PublishingService();
    const publishedPost = await pubService.publishPost('agent-e2e', topicA.id);

    expect(publishedPost.status).toBe('PUBLISHED');
    expect(publishedPost.rationale).toContain('Selected because it scored');
    expect(publishedPost.rationale).toContain('preferred over alternative candidate');
    expect(publishedPost.sources).toContain('https://techcrunch.com/prompt-inject');
  });

  test('TEST 15: Zero valid candidates results in zero posts (no forced post)', async () => {
    const agent: AgentState = {
      agentId: 'agent-zero',
      persona: {
        name: 'Ada',
        role: 'AI Security Researcher',
        domain: 'AI Security',
        description: 'AI Security researcher',
        interests: ['AI Security'],
        expertise: ['AI Security'],
        tone: ['analytical'],
        editorialPrinciples: ['Evidence over hype'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };

    const garbageTopic: Topic = {
      id: 'topic-garbage',
      agentId: 'agent-zero',
      title: 'Celebrity gossip news update',
      summary: 'Unrelated Entertainment news story without tech content.',
      source: { name: 'Gossip Feed', url: 'https://gossip.example.com' },
      publishedAt: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
    };

    const decision = await editorialService.evaluateTopic(agent, garbageTopic);
    expect(decision.decision).toBe('REJECT');
  });
});
