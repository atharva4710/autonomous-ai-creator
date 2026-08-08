import request from 'supertest';
import app from '../src/server';

describe('GET /health', () => {
  it('should return HTTP 200 with status "ok"', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('should return HTTP 404 for unknown routes', async () => {
    const response = await request(app).get('/invalid-route-path');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error.message).toContain('Route not found');
  });
});
