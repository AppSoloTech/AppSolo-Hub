import { createDatabase, resolvedTestDatabaseUrl } from '@appsolo/database';
import { seedDatabase, seedIds } from '@appsolo/database/seed';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

const databaseUrl = resolvedTestDatabaseUrl(process.env);
const { pool, db } = createDatabase(databaseUrl);
const config = {
  NODE_ENV: 'test' as const,
  PORT: 4000,
  DATABASE_URL: databaseUrl,
  LOG_LEVEL: 'fatal' as const,
  CORS_ORIGIN: ['http://localhost:5173'],
  DEV_AUTH_ENABLED: true,
  APPSOLO_USE_TEST_DATABASE: false,
  REQUEST_BODY_LIMIT: '1mb',
};
const app = createApp({ db, config });
const auth = (userId: string) => ({ 'x-dev-user-id': userId });
const path = (requestId: string, query = '') => `/api/v1/change-requests/${requestId}/comments${query}`;

beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE estimate_responses, access_audit_events, organization_invitations, attachments, time_entries, status_history, comments, estimates, change_requests, projects, organization_memberships, organizations, users RESTART IDENTITY CASCADE',
  );
  await seedDatabase(databaseUrl);
});

afterAll(async () => {
  await pool.end();
});

describe('comment API integration', () => {
  it('exposes the exact centralized role capability matrix', async () => {
    const roles = [
      [
        seedIds.owner,
        ['VIEW_COMMENTS', 'CREATE_CLIENT_COMMENTS', 'VIEW_INTERNAL_COMMENTS', 'CREATE_INTERNAL_COMMENTS'],
      ],
      [
        seedIds.developer,
        ['VIEW_COMMENTS', 'CREATE_CLIENT_COMMENTS', 'VIEW_INTERNAL_COMMENTS', 'CREATE_INTERNAL_COMMENTS'],
      ],
      [seedIds.clientAdmin, ['VIEW_COMMENTS', 'CREATE_CLIENT_COMMENTS']],
      [seedIds.clientMember, ['VIEW_COMMENTS', 'CREATE_CLIENT_COMMENTS']],
    ] as const;

    for (const [userId, expected] of roles) {
      const response = await request(app).get('/api/v1/session').set(auth(userId));
      const body = response.body as {
        data: { memberships: Array<{ organizationId: string; capabilities: string[] }> };
      };
      const membership = body.data.memberships.find(
        (candidate) => candidate.organizationId === seedIds.clientOrganization,
      );
      expect(membership?.capabilities).toEqual(expect.arrayContaining([...expected]));
      if (userId === seedIds.clientAdmin || userId === seedIds.clientMember) {
        expect(membership?.capabilities).not.toContain('VIEW_INTERNAL_COMMENTS');
        expect(membership?.capabilities).not.toContain('CREATE_INTERNAL_COMMENTS');
      }
    }

    await pool.query(
      "UPDATE organization_memberships SET role = 'ADMIN' WHERE user_id = $1 AND organization_id = $2",
      [seedIds.developer, seedIds.clientOrganization],
    );
    const admin = await request(app).get('/api/v1/session').set(auth(seedIds.developer));
    const adminBody = admin.body as {
      data: { memberships: Array<{ organizationId: string; capabilities: string[] }> };
    };
    const adminMembership = adminBody.data.memberships.find(
      (candidate) => candidate.organizationId === seedIds.clientOrganization,
    );
    expect(adminMembership?.capabilities).toEqual(
      expect.arrayContaining([
        'VIEW_COMMENTS',
        'CREATE_CLIENT_COMMENTS',
        'VIEW_INTERNAL_COMMENTS',
        'CREATE_INTERNAL_COMMENTS',
      ]),
    );
  });

  it('filters internal rows before client pagination and exposes no existence signal', async () => {
    const internal = await request(app)
      .get(path(seedIds.requestOne, '?limit=1&offset=0'))
      .set(auth(seedIds.owner));
    expect(internal.status).toBe(200);
    expect(internal.body).toMatchObject({
      data: [{ id: seedIds.sharedComment }],
      meta: {
        count: 1,
        limit: 1,
        offset: 0,
        canCreateClientComments: true,
        canViewInternalComments: true,
        canCreateInternalComments: true,
      },
    });

    const internalSecond = await request(app)
      .get(path(seedIds.requestOne, '?limit=1&offset=1'))
      .set(auth(seedIds.owner));
    expect(internalSecond.body).toMatchObject({ data: [{ id: seedIds.internalComment }] });

    for (const userId of [seedIds.clientAdmin, seedIds.clientMember]) {
      const first = await request(app).get(path(seedIds.requestOne, '?limit=1&offset=0')).set(auth(userId));
      const second = await request(app).get(path(seedIds.requestOne, '?limit=1&offset=1')).set(auth(userId));
      expect(first.body).toMatchObject({
        data: [
          {
            id: seedIds.sharedComment,
            visibility: 'CLIENT_VISIBLE',
            authorDisplayName: 'Casey Admin',
          },
        ],
        meta: {
          count: 1,
          canCreateClientComments: true,
          canViewInternalComments: false,
          canCreateInternalComments: false,
        },
      });
      expect(second.body).toMatchObject({ data: [], meta: { count: 0, offset: 1 } });
      const serialized = JSON.stringify([first.body, second.body]);
      expect(serialized).not.toContain(seedIds.internalComment);
      expect(serialized).not.toContain('Internal implementation note');
      expect(serialized).not.toContain('developer@appsolo.test');
    }
  });

  it('creates trimmed server-owned comments for both allowed visibilities', async () => {
    const before = await pool.query<{
      request_status: string;
      estimate_status: string;
      history_count: string;
    }>(
      `SELECT cr.status AS request_status, e.status AS estimate_status,
        (SELECT count(*)::text FROM status_history sh WHERE sh.change_request_id = cr.id) AS history_count
       FROM change_requests cr
       JOIN estimates e ON e.change_request_id = cr.id
       WHERE cr.id = $1`,
      [seedIds.requestClarification],
    );
    const shared = await request(app)
      .post(path(seedIds.requestClarification))
      .set(auth(seedIds.clientMember))
      .send({ body: '  Client follow-up remains shared.  ', visibility: 'CLIENT_VISIBLE' });
    expect(shared.status).toBe(201);
    expect(shared.body).toMatchObject({
      data: {
        changeRequestId: seedIds.requestClarification,
        body: 'Client follow-up remains shared.',
        visibility: 'CLIENT_VISIBLE',
        authorDisplayName: 'Morgan Member',
      },
      meta: {},
    });
    const sharedDto = (shared.body as { data: Record<string, unknown> }).data;
    expect(Object.keys(sharedDto).sort()).toEqual(
      ['authorDisplayName', 'body', 'changeRequestId', 'createdAt', 'id', 'visibility'].sort(),
    );

    const internal = await request(app)
      .post(path(seedIds.requestClarification))
      .set(auth(seedIds.developer))
      .send({ body: '  Private implementation context.  ', visibility: 'INTERNAL_ONLY' });
    expect(internal.status).toBe(201);
    expect(internal.body).toMatchObject({
      data: { body: 'Private implementation context.', visibility: 'INTERNAL_ONLY' },
    });

    const after = await pool.query<{
      request_status: string;
      estimate_status: string;
      history_count: string;
    }>(
      `SELECT cr.status AS request_status, e.status AS estimate_status,
        (SELECT count(*)::text FROM status_history sh WHERE sh.change_request_id = cr.id) AS history_count
       FROM change_requests cr
       JOIN estimates e ON e.change_request_id = cr.id
       WHERE cr.id = $1`,
      [seedIds.requestClarification],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('returns 403 for client internal creation without inserting a row', async () => {
    const before = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM comments WHERE change_request_id = $1',
      [seedIds.requestOne],
    );
    for (const userId of [seedIds.clientAdmin, seedIds.clientMember]) {
      const response = await request(app)
        .post(path(seedIds.requestOne))
        .set(auth(userId))
        .send({ body: 'Must not be inserted.', visibility: 'INTERNAL_ONLY' });
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ error: { code: 'FORBIDDEN', details: [] } });
    }
    const after = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM comments WHERE change_request_id = $1',
      [seedIds.requestOne],
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });

  it('uses safe validation and indistinguishable missing/inaccessible 404 responses', async () => {
    for (const body of [
      { body: ' ', visibility: 'CLIENT_VISIBLE' },
      { body: 'x'.repeat(5001), visibility: 'CLIENT_VISIBLE' },
      { body: 3, visibility: 'CLIENT_VISIBLE' },
      { body: 'Valid', visibility: 'CLIENT_VISIBLE', authorUserId: seedIds.owner },
    ]) {
      const response = await request(app).post(path(seedIds.requestOne)).set(auth(seedIds.owner)).send(body);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(JSON.stringify(response.body)).not.toContain('developer@appsolo.test');
    }
    const unsupportedText = await request(app)
      .post(path(seedIds.requestOne))
      .set(auth(seedIds.owner))
      .send({ body: 'before\u0000after', visibility: 'CLIENT_VISIBLE' });
    expect(unsupportedText.status).toBe(400);
    expect(unsupportedText.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ path: 'body', message: 'Comment contains an unsupported character.' }],
      },
    });
    const unknownQuery = await request(app)
      .get(path(seedIds.requestOne, '?visibility=INTERNAL_ONLY'))
      .set(auth(seedIds.owner));
    expect(unknownQuery.status).toBe(400);
    const unknownCreateQuery = await request(app)
      .post(path(seedIds.requestOne, '?limit=1'))
      .set(auth(seedIds.owner))
      .send({ body: 'Valid body', visibility: 'CLIENT_VISIBLE' });
    expect(unknownCreateQuery.status).toBe(400);

    const missingId = '30000000-0000-4000-8000-000000000099';
    const missing = await request(app).get(path(missingId)).set(auth(seedIds.owner));
    const inaccessible = await request(app).get(path(seedIds.otherTenantRequest)).set(auth(seedIds.owner));
    const internalOnly = await request(app).get(path(seedIds.requestOne)).set(auth(seedIds.internalOnlyUser));
    for (const response of [missing, inaccessible, internalOnly]) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
      });
    }
  });

  it('omits comment bodies and database details from error-path application logs', async () => {
    const sentinel = 'P004_INTERNAL_LOG_SENTINEL';
    const logLines: string[] = [];
    const logDestination: DestinationStream = {
      write(message) {
        logLines.push(message);
      },
    };
    const loggingApp = createApp({
      db,
      config: { ...config, LOG_LEVEL: 'error' },
      logDestination,
    });

    await pool.query(`
      CREATE FUNCTION appsolo_test_reject_comment_insert()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'forced comment insert failure';
      END;
      $$
    `);
    await pool.query(`
      CREATE TRIGGER appsolo_test_reject_comment_insert
      BEFORE INSERT ON comments
      FOR EACH ROW
      EXECUTE FUNCTION appsolo_test_reject_comment_insert()
    `);

    try {
      const response = await request(loggingApp)
        .post(path(seedIds.requestOne))
        .set(auth(seedIds.owner))
        .send({ body: sentinel, visibility: 'INTERNAL_ONLY' });
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      });
    } finally {
      await pool.query('DROP TRIGGER appsolo_test_reject_comment_insert ON comments');
      await pool.query('DROP FUNCTION appsolo_test_reject_comment_insert()');
    }

    const serializedLogs = logLines.join('');
    expect(serializedLogs).toContain('unhandled request error');
    expect(serializedLogs).toContain('"err":{"type":');
    expect(serializedLogs).not.toContain(sentinel);
    expect(serializedLogs).not.toContain('"params"');
    expect(serializedLogs).not.toContain('"query"');
    expect(serializedLogs).not.toContain('"stack"');
    expect(serializedLogs).not.toContain('forced comment insert failure');
  });

  it('orders equal timestamps by ID, paginates deterministically, and retains concurrent creates', async () => {
    const ordered = await request(app)
      .get(path(seedIds.requestOne, '?limit=2&offset=0'))
      .set(auth(seedIds.owner));
    expect((ordered.body as { data: Array<{ id: string }> }).data.map((comment) => comment.id)).toEqual([
      seedIds.sharedComment,
      seedIds.internalComment,
    ]);

    const concurrent = await Promise.all([
      request(app)
        .post(path(seedIds.requestOne))
        .set(auth(seedIds.owner))
        .send({ body: 'Concurrent one', visibility: 'INTERNAL_ONLY' }),
      request(app)
        .post(path(seedIds.requestOne))
        .set(auth(seedIds.owner))
        .send({ body: 'Concurrent two', visibility: 'CLIENT_VISIBLE' }),
    ]);
    expect(concurrent.map((response) => response.status)).toEqual([201, 201]);
    const persisted = await pool.query<{ body: string }>(
      "SELECT body FROM comments WHERE change_request_id = $1 AND body LIKE 'Concurrent %' ORDER BY created_at, id",
      [seedIds.requestOne],
    );
    expect(persisted.rows.map((row) => row.body).sort()).toEqual(['Concurrent one', 'Concurrent two']);
  });

  it('keeps suspended authorship visible while suspended membership and user state deny access', async () => {
    const visible = await request(app)
      .get(path(seedIds.requestClarification))
      .set(auth(seedIds.clientMember));
    const visibleBody = visible.body as {
      data: Array<{ id: string; authorDisplayName: string }>;
    };
    expect(visibleBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: seedIds.suspendedAuthorComment,
          authorDisplayName: 'Sam Suspended',
        }),
      ]),
    );
    const denied = await request(app)
      .get(path(seedIds.requestClarification))
      .set(auth(seedIds.suspendedMember));
    expect(denied.status).toBe(404);
    await pool.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [seedIds.suspendedMember]);
    const globallyDenied = await request(app)
      .get(path(seedIds.requestClarification))
      .set(auth(seedIds.suspendedMember));
    expect(globallyDenied.status).toBe(401);
  });

  it('immediately denies inactive project and organization scopes', async () => {
    await pool.query("UPDATE projects SET status = 'ON_HOLD' WHERE id = $1", [seedIds.project]);
    const inactiveProject = await request(app).get(path(seedIds.requestOne)).set(auth(seedIds.owner));
    expect(inactiveProject.status).toBe(404);

    await pool.query("UPDATE projects SET status = 'ACTIVE' WHERE id = $1", [seedIds.project]);
    await pool.query("UPDATE organizations SET status = 'INACTIVE' WHERE id = $1", [
      seedIds.clientOrganization,
    ]);
    const inactiveOrganization = await request(app)
      .post(path(seedIds.requestOne))
      .set(auth(seedIds.owner))
      .send({ body: 'Must not be created.', visibility: 'CLIENT_VISIBLE' });
    expect(inactiveOrganization.status).toBe(404);
  });

  it('preserves clarification reason and every comment through a P003 revision submission', async () => {
    const before = await request(app).get(path(seedIds.requestClarification)).set(auth(seedIds.owner));
    const beforeIds = (before.body as { data: Array<{ id: string }> }).data.map((comment) => comment.id);

    const draft = await request(app)
      .post(`/api/v1/change-requests/${seedIds.requestClarification}/estimates`)
      .set(auth(seedIds.owner))
      .send({
        estimatedHours: '2.00',
        hourlyRate: '150.00',
        scopeNotes: 'Revised alert-threshold scope after the shared clarification discussion.',
      });
    expect(draft.status).toBe(201);
    const draftBody = draft.body as { data: { id: string; updatedAt: string } };
    const submitted = await request(app)
      .post(`/api/v1/estimates/${draftBody.data.id}/submit`)
      .set(auth(seedIds.owner))
      .send({ expectedUpdatedAt: draftBody.data.updatedAt });
    expect(submitted.status).toBe(200);

    const after = await request(app).get(path(seedIds.requestClarification)).set(auth(seedIds.owner));
    expect((after.body as { data: Array<{ id: string }> }).data.map((comment) => comment.id)).toEqual(
      beforeIds,
    );
    const reason = await pool.query<{ note: string }>(
      `SELECT er.note
       FROM estimate_responses er
       WHERE er.estimate_id = $1`,
      [seedIds.clarificationEstimate],
    );
    expect(reason.rows[0]?.note).toBe('Which thresholds are included in the estimate?');
  });
});
