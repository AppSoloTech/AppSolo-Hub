import { createDatabase, resolvedTestDatabaseUrl } from '@appsolo/database';
import { seedDatabase, seedIds } from '@appsolo/database/seed';
import { statusHistory } from '@appsolo/database/schema';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

const databaseUrl = resolvedTestDatabaseUrl(process.env);
const { db, pool } = createDatabase(databaseUrl);
const config = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'info' as const,
  CORS_ORIGIN: ['http://localhost:5173'],
  DEV_AUTH_ENABLED: true,
  APPSOLO_USE_TEST_DATABASE: false,
  REQUEST_BODY_LIMIT: '1mb',
};
const app = createApp({ db, config });
const projectPath = `/api/v1/projects/${seedIds.project}/change-requests`;
beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE attachments, time_entries, status_history, comments, estimates, change_requests, projects, organization_memberships, organizations, users RESTART IDENTITY CASCADE',
  );
  await seedDatabase(databaseUrl);
});
afterAll(async () => {
  await pool.end();
});

describe('change request API integration', () => {
  it('reports real database health and rejects missing or unknown simulated identities', async () => {
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    expect((await request(app).get(projectPath)).status).toBe(401);
    expect(
      (await request(app).get(projectPath).set('x-dev-user-id', '20000000-0000-4000-8000-000000000099'))
        .status,
    ).toBe(401);
  });
  it('creates a request and its initial submitted history in one transaction', async () => {
    const response = await request(app).post(projectPath).set('x-dev-user-id', seedIds.clientAdmin).send({
      title: 'Persist a request',
      description: 'Verify that this request and its first history record persist.',
      priority: 'HIGH',
      requestedCompletionDate: '2026-10-01',
    });
    const body = response.body as { data: { id: string; status: string; projectId: string } };
    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({ projectId: seedIds.project, status: 'SUBMITTED' });
    const history = await db.select().from(statusHistory);
    expect(
      history.some(
        (entry) =>
          entry.changeRequestId === body.data.id &&
          entry.newStatus === 'SUBMITTED' &&
          entry.previousStatus === null,
      ),
    ).toBe(true);
  });
  it('scopes list and detail access to the authorized tenant', async () => {
    const authorized = await request(app).get(projectPath).set('x-dev-user-id', seedIds.clientAdmin);
    const list = authorized.body as { data: Array<{ id: string; projectId: string }> };
    expect(authorized.status).toBe(200);
    expect(list.data).toHaveLength(2);
    expect(list.data.every((entry) => entry.projectId === seedIds.project)).toBe(true);
    expect(list.data.map((entry) => entry.id)).toEqual([seedIds.requestTwo, seedIds.requestOne]);
    const detail = await request(app)
      .get(`/api/v1/change-requests/${seedIds.requestOne}`)
      .set('x-dev-user-id', seedIds.clientAdmin);
    expect((detail.body as { data: { id: string } }).data.id).toBe(seedIds.requestOne);
    const deniedList = await request(app).get(projectPath).set('x-dev-user-id', seedIds.otherTenantUser);
    const deniedDetail = await request(app)
      .get(`/api/v1/change-requests/${seedIds.requestOne}`)
      .set('x-dev-user-id', seedIds.otherTenantUser);
    const deniedCreate = await request(app)
      .post(projectPath)
      .set('x-dev-user-id', seedIds.otherTenantUser)
      .send({ title: 'Denied create', description: 'This cross-tenant create must never persist.' });
    const internalOnly = await request(app).get(projectPath).set('x-dev-user-id', seedIds.internalOnlyUser);
    expect(deniedList.status).toBe(403);
    expect(deniedList.body).not.toHaveProperty('data');
    expect(deniedDetail.status).toBe(404);
    expect(deniedDetail.body).not.toHaveProperty('data');
    expect(deniedCreate.status).toBe(403);
    expect(internalOnly.status).toBe(403);
  });
  it('uses the stable validation envelope for unknown write fields', async () => {
    const response = await request(app)
      .post(projectPath)
      .set('x-dev-user-id', seedIds.clientAdmin)
      .send({ title: 'No', description: 'short', unknown: true });
    const body = response.body as { error: { code: string; details: Array<{ path: string }> } };
    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.length).toBeGreaterThan(0);
  });
});
