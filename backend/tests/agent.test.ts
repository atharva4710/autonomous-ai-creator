import request from 'supertest';
import app from '../src/server';

describe('Agent Initialization Endpoint (POST /api/agent/init)', () => {
  it('should initialize an agent successfully with valid persona', async () => {
    const response = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada',
          domain: 'AI Security',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('agentId');
    expect(typeof response.body.agentId).toBe('string');
    expect(response.body.agentId).toMatch(/^agent-[a-f0-9]{8}$/);
  });

  it('should generate different IDs for distinct initialization requests', async () => {
    const response1 = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada',
          domain: 'AI Security',
        },
      });

    const response2 = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Nova',
          domain: 'AI Agents',
        },
      });

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);
    expect(response1.body.agentId).not.toEqual(response2.body.agentId);
  });

  it('should fail with HTTP 400 when persona field is missing', async () => {
    const response = await request(app).post('/api/agent/init').send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.status).toBe(400);
  });

  it('should fail with HTTP 400 when name is missing or empty', async () => {
    const response = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: '',
          domain: 'AI Security',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Invalid persona data');
  });

  it('should fail with HTTP 400 when domain is missing or empty', async () => {
    const response = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: 'Ada',
          domain: '',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Invalid persona data');
  });

  it('should fail with HTTP 400 when inputs are whitespace-only', async () => {
    const response = await request(app)
      .post('/api/agent/init')
      .send({
        persona: {
          name: '   ',
          domain: 'AI Security',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Invalid persona data');
  });
});

describe('Existing Health Endpoint (GET /health)', () => {
  it('should still return HTTP 200 with status "ok"', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
