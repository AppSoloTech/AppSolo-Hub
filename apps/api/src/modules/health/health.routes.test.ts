import express, { type NextFunction, type Request, type Response } from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../errors.js';
import { requestIdMiddleware } from '../../middleware/request-id.js';
import { healthRouter, type HealthDatabase } from './health.routes.js';

const createHealthApp = (db: HealthDatabase) => {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  app.use('/api/v1', healthRouter(db));
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    void _next;
    const known =
      error instanceof AppError
        ? error
        : new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.');
    response.status(known.status).json({
      error: {
        code: known.code,
        message: known.message,
        requestId: request.requestId,
      },
    });
  });
  return app;
};

describe('health endpoint', () => {
  it('reports safe readiness failures', async () => {
    const app = createHealthApp({
      execute: () => Promise.reject(new Error('connection failure')),
    });
    const response = await request(app).get('/api/v1/health');
    const body = response.body as { error: { code: string } };
    expect(response.status).toBe(503);
    expect(body.error).toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
    expect(JSON.stringify(body)).not.toContain('connection failure');
  });

  it('reports readiness when the database check succeeds', async () => {
    const app = createHealthApp({
      execute: () => Promise.resolve(),
    });
    const response = await request(app).get('/api/v1/health');
    const body = response.body as { data: unknown };
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ status: 'ok', database: 'ok' });
  });
});
