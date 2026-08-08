import request from 'supertest';
import app from '../src/server';
import { parseRssXml } from '../src/utils/rssParser';

// Sample mock RSS XML feed text
const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mock Tech Feed</title>
    <link>https://mock.example.com</link>
    <description>Mock Description</description>
    <item>
      <title><![CDATA[New LLM Security vulnerability identified in agents]]></title>
      <link>https://mock.example.com/vuln-1</link>
      <description><![CDATA[<p>Researchers have identified a security issue in conversational agents.</p>]]></description>
      <pubDate>Sat, 08 Aug 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>General technology model release details</title>
      <link>https://mock.example.com/release-1</link>
      <description>A new model was released today for general language tasks.</description>
      <pubDate>Sat, 08 Aug 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe('RSS XML Parser Helper (parseRssXml)', () => {
  it('should parse standard XML items and clean CDATA correctly', () => {
    const items = parseRssXml(mockRssXml);
    expect(items.length).toBe(2);
    expect(items[0].title).toBe('New LLM Security vulnerability identified in agents');
    expect(items[0].link).toBe('https://mock.example.com/vuln-1');
    expect(items[0].description).toBe('<p>Researchers have identified a security issue in conversational agents.</p>');
    expect(items[0].pubDate).toBe('Sat, 08 Aug 2026 12:00:00 GMT');
  });
});

describe('Discovery API Endpoints', () => {
  let agentId: string;
  let originalFetch: typeof global.fetch;

  beforeAll(async () => {
    originalFetch = global.fetch;

    // Create an agent first to run discovery tests against
    const response = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada',
          domain: 'AI Security',
        },
      });
    agentId = response.body.agentId;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    // Mock global fetch to return our sample RSS XML
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRssXml),
      } as Response)
    );
  });

  it('should trigger discovery and return the number of topics discovered', async () => {
    const response = await request(app)
      .post('/api/agent/discover')
      .send({ agentId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('discovered');
    expect(response.body.discovered).toBeGreaterThanOrEqual(0);
  });

  it('should retrieve discovered topics for a valid agent ID', async () => {
    // 1. Run discovery
    await request(app)
      .post('/api/agent/discover')
      .send({ agentId });

    // 2. Query topics
    const response = await request(app)
      .get(`/api/agent/topics?agentId=${agentId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('topics');
    expect(Array.isArray(response.body.topics)).toBe(true);
    expect(response.body.topics.length).toBeGreaterThan(0);

    const firstTopic = response.body.topics[0];
    expect(firstTopic).toHaveProperty('id');
    expect(firstTopic).toHaveProperty('title');
    expect(firstTopic).toHaveProperty('summary');
    expect(firstTopic).toHaveProperty('source');
    expect(firstTopic.source).toHaveProperty('name');
    expect(firstTopic.source).toHaveProperty('url');
    expect(firstTopic).toHaveProperty('publishedAt');
    expect(firstTopic).toHaveProperty('discoveredAt');

    // HTML tag stripping verification
    expect(firstTopic.summary).not.toContain('<p>');
    expect(firstTopic.summary).not.toContain('</p>');
  });

  it('should rank topics based on domain relevance keywords (AI Security matches first)', async () => {
    await request(app)
      .post('/api/agent/discover')
      .send({ agentId });

    const response = await request(app)
      .get(`/api/agent/topics?agentId=${agentId}`);

    const topics = response.body.topics;
    // The first item in mock XML matches 'Security' and 'AI' in title, so it should rank higher/earlier
    expect(topics[0].title).toBe('New LLM Security vulnerability identified in agents');
  });

  it('should fail with HTTP 400 when agentId is missing in POST /discover', async () => {
    const response = await request(app)
      .post('/api/agent/discover')
      .send({});

    expect(response.status).toBe(400);
  });

  it('should fail with HTTP 404 when non-existent agentId is provided in POST /discover', async () => {
    const response = await request(app)
      .post('/api/agent/discover')
      .send({ agentId: 'agent-nonexistent123' });

    expect(response.status).toBe(404);
  });

  it('should fail with HTTP 400 when agentId is missing in GET /topics', async () => {
    const response = await request(app).get('/api/agent/topics');
    expect(response.status).toBe(400);
  });

  it('should fail with HTTP 404 when non-existent agentId is queried in GET /topics', async () => {
    const response = await request(app).get('/api/agent/topics?agentId=agent-nonexistent123');
    expect(response.status).toBe(404);
  });

  it('should return empty array for an agent that has not discovered any topics yet', async () => {
    // Create new agent
    const initRes = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Nova',
          domain: 'AI Agents',
        },
      });
    const newAgentId = initRes.body.agentId;

    const response = await request(app)
      .get(`/api/agent/topics?agentId=${newAgentId}`);

    expect(response.status).toBe(200);
    expect(response.body.topics).toEqual([]);
  });
});
