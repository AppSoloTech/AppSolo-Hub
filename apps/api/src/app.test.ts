import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
const config = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  DATABASE_URL: 'postgresql://local/test',
  LOG_LEVEL: 'info' as const,
  CORS_ORIGIN: ['http://localhost:5173'],
  DEV_AUTH_ENABLED: true,
  APPSOLO_USE_TEST_DATABASE: false,
  REQUEST_BODY_LIMIT: '1mb',
};
describe('health endpoint', () => {
  it('reports safe readiness failures', async () => {
    const app = createApp({
      db: {} as never,
      config,
      checkDatabase: () => Promise.reject(new Error('connection failure')),
    });
    const response = await request(app).get('/api/v1/health');
    const body = response.body as { error: { code: string } };
    expect(response.status).toBe(503);
    expect(body.error).toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
    expect(JSON.stringify(body)).not.toContain('connection failure');
  });
  it('reports readiness when the check succeeds', async () => {
    const app = createApp({ db: {} as never, config, checkDatabase: () => Promise.resolve() });
    const response = await request(app).get('/api/v1/health');
    const body = response.body as { data: unknown };
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ status: 'ok', database: 'ok' });
  });
  it('maps malformed and oversized JSON bodies to safe client errors', async () => {
    const app = createApp({ db: {} as never, config, checkDatabase: () => Promise.resolve() });
    const malformed = await request(app)
      .post('/api/v1/projects/10000000-0000-4000-8000-000000000003/change-requests')
      .set('content-type', 'application/json')
      .send('{"title":');
    const large = await request(app)
      .post('/api/v1/projects/10000000-0000-4000-8000-000000000003/change-requests')
      .set('content-type', 'application/json')
      .send({ description: 'x'.repeat(1_100_000) });
    expect(malformed.status).toBe(400);
    expect(large.status).toBe(413);
    expect((large.body as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
