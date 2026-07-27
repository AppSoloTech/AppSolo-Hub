import { createDatabase, resolvedTestDatabaseUrl } from '@appsolo/database';
import { seedDatabase, seedIds } from '@appsolo/database/seed';
import type { DestinationStream } from 'pino';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

const databaseUrl = resolvedTestDatabaseUrl(process.env);
const { db, pool } = createDatabase(databaseUrl);
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
const timePath = (requestId: string, query = '') =>
  `/api/v1/change-requests/${requestId}/time-entries${query}`;
const historyPath = (requestId: string, query = '') => `/api/v1/change-requests/${requestId}/history${query}`;

beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE work_review_responses, work_review_handoffs, estimate_responses, access_audit_events, organization_invitations, attachments, time_entries, status_history, comments, estimates, change_requests, projects, organization_memberships, organizations, users RESTART IDENTITY CASCADE',
  );
  await seedDatabase(databaseUrl);
});

afterAll(async () => {
  await pool.end();
});

describe('P005 work API integration', () => {
  it('exposes the exact centralized work capability matrix', async () => {
    const matrix = [
      [
        seedIds.owner,
        [
          'VIEW_REQUEST_HISTORY',
          'VIEW_PRIVATE_TIME',
          'CREATE_PRIVATE_TIME',
          'VOID_OWN_PRIVATE_TIME',
          'MANAGE_PRIVATE_TIME',
          'MANAGE_REQUEST_WORK',
          'CANCEL_REQUESTS',
        ],
      ],
      [
        seedIds.developer,
        [
          'VIEW_REQUEST_HISTORY',
          'VIEW_PRIVATE_TIME',
          'CREATE_PRIVATE_TIME',
          'VOID_OWN_PRIVATE_TIME',
          'MANAGE_REQUEST_WORK',
        ],
      ],
      [seedIds.clientAdmin, ['VIEW_REQUEST_HISTORY', 'RESPOND_TO_WORK_REVIEW', 'CANCEL_REQUESTS']],
      [seedIds.clientMember, ['VIEW_REQUEST_HISTORY']],
    ] as const;
    for (const [userId, expected] of matrix) {
      const response = await request(app).get('/api/v1/session').set(auth(userId));
      const membership = (
        response.body as {
          data: {
            memberships: Array<{
              organizationId: string;
              capabilities: string[];
            }>;
          };
        }
      ).data.memberships.find((candidate) => candidate.organizationId === seedIds.clientOrganization);
      expect(membership?.capabilities).toEqual(expect.arrayContaining([...expected]));
    }
    const client = await request(app).get('/api/v1/session').set(auth(seedIds.clientAdmin));
    expect(JSON.stringify(client.body)).not.toContain('VIEW_PRIVATE_TIME');
    expect(JSON.stringify(client.body)).not.toContain('MANAGE_REQUEST_WORK');

    await pool.query(
      "UPDATE organization_memberships SET role = 'ADMIN' WHERE user_id = $1 AND organization_id = $2",
      [seedIds.developer, seedIds.clientOrganization],
    );
    const admin = await request(app).get('/api/v1/session').set(auth(seedIds.developer));
    const adminMembership = (
      admin.body as {
        data: {
          memberships: Array<{
            organizationId: string;
            capabilities: string[];
          }>;
        };
      }
    ).data.memberships.find((candidate) => candidate.organizationId === seedIds.clientOrganization);
    expect(adminMembership?.capabilities).toEqual(
      expect.arrayContaining([
        'VIEW_REQUEST_HISTORY',
        'VIEW_PRIVATE_TIME',
        'CREATE_PRIVATE_TIME',
        'VOID_OWN_PRIVATE_TIME',
        'MANAGE_PRIVATE_TIME',
        'MANAGE_REQUEST_WORK',
        'CANCEL_REQUESTS',
      ]),
    );
  });

  it('creates private time only in progress and never returns time output to clients', async () => {
    const created = await request(app)
      .post(timePath(seedIds.requestInProgress))
      .set(auth(seedIds.developer))
      .send({
        durationMinutes: 45,
        description: '  Added integration coverage for private time.  ',
        workDate: '2026-07-27',
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      data: {
        changeRequestId: seedIds.requestInProgress,
        durationMinutes: 45,
        description: 'Added integration coverage for private time.',
        authorUserId: seedIds.developer,
        voidedAt: null,
      },
    });
    const list = await request(app)
      .get(timePath(seedIds.requestInProgress, '?limit=2&offset=0'))
      .set(auth(seedIds.owner));
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({
      meta: {
        count: 2,
        activeDurationMinutes: 150,
        canCreate: true,
        canManage: true,
      },
    });
    for (const userId of [seedIds.clientAdmin, seedIds.clientMember]) {
      const denied = await request(app).get(timePath(seedIds.requestInProgress)).set(auth(userId));
      expect(denied.status).toBe(404);
      expect(JSON.stringify(denied.body)).not.toContain(seedIds.activeTimeEntry);
      expect(JSON.stringify(denied.body)).not.toContain('150');
      const deniedCreate = await request(app)
        .post(timePath(seedIds.requestInProgress))
        .set(auth(userId))
        .send({
          durationMinutes: 30,
          description: 'Client roles cannot create private time.',
          workDate: '2026-07-27',
        });
      expect(deniedCreate.status).toBe(404);
      expect(deniedCreate.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
          details: [],
        },
      });
    }
    const invalidState = await request(app)
      .post(timePath(seedIds.requestApproved))
      .set(auth(seedIds.developer))
      .send({
        durationMinutes: 30,
        description: 'Cannot log before starting work.',
        workDate: '2026-07-27',
      });
    expect(invalidState.status).toBe(409);
  });

  it('voids durably with exact own/all authority and one concurrent success', async () => {
    for (const userId of [seedIds.clientAdmin, seedIds.clientMember]) {
      const input = {
        reason: 'Client roles cannot inspect or void private time.',
        expectedUpdatedAt: '2026-07-27T09:30:00.000Z',
      };
      const existing = await request(app)
        .post(`/api/v1/time-entries/${seedIds.activeTimeEntry}/void`)
        .set(auth(userId))
        .send(input);
      const missing = await request(app)
        .post('/api/v1/time-entries/61000000-0000-4000-8000-000000000099/void')
        .set(auth(userId))
        .send(input);
      expect(existing.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(existing.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
          details: [],
        },
      });
    }

    const developerOwn = await request(app)
      .post(`/api/v1/time-entries/${seedIds.activeTimeEntry}/void`)
      .set(auth(seedIds.developer))
      .send({
        reason: 'Replacing this entry with corrected detail.',
        expectedUpdatedAt: '2026-07-27T09:30:00.000Z',
      });
    expect(developerOwn.status).toBe(200);
    expect(developerOwn.body).toMatchObject({
      data: {
        id: seedIds.activeTimeEntry,
        durationMinutes: 90,
        voidReason: 'Replacing this entry with corrected detail.',
        voidedByUserId: seedIds.developer,
      },
    });
    const repeat = await request(app)
      .post(`/api/v1/time-entries/${seedIds.activeTimeEntry}/void`)
      .set(auth(seedIds.developer))
      .send({
        reason: 'A second void must not succeed.',
        expectedUpdatedAt: '2026-07-27T09:30:00.000Z',
      });
    expect(repeat.status).toBe(409);

    const developerOther = await request(app)
      .post(`/api/v1/time-entries/${seedIds.voidedTimeEntry}/void`)
      .set(auth(seedIds.developer))
      .send({
        reason: 'Developer cannot void another author.',
        expectedUpdatedAt: '2026-07-27T10:00:00.000Z',
      });
    expect(developerOther.status).toBe(403);

    const create = await request(app)
      .post(timePath(seedIds.requestInProgress))
      .set(auth(seedIds.developer))
      .send({
        durationMinutes: 20,
        description: 'Concurrent void target entry.',
        workDate: '2026-07-27',
      });
    const entry = (create.body as { data: { id: string; updatedAt: string } }).data;
    const calls = await Promise.all([
      request(app)
        .post(`/api/v1/time-entries/${entry.id}/void`)
        .set(auth(seedIds.owner))
        .send({ reason: 'Owner correction one.', expectedUpdatedAt: entry.updatedAt }),
      request(app)
        .post(`/api/v1/time-entries/${entry.id}/void`)
        .set(auth(seedIds.owner))
        .send({ reason: 'Owner correction two.', expectedUpdatedAt: entry.updatedAt }),
    ]);
    expect(calls.map((response) => response.status).sort()).toEqual([200, 409]);
  });

  it('runs an atomic repeated review cycle through client completion', async () => {
    const detail = await request(app)
      .get(`/api/v1/change-requests/${seedIds.requestApproved}`)
      .set(auth(seedIds.developer));
    let updatedAt = (detail.body as { data: { updatedAt: string } }).data.updatedAt;
    const started = await request(app)
      .post(`/api/v1/change-requests/${seedIds.requestApproved}/work/start`)
      .set(auth(seedIds.developer))
      .send({ expectedUpdatedAt: updatedAt });
    expect(started.status).toBe(200);
    updatedAt = (started.body as { data: { updatedAt: string } }).data.updatedAt;

    const firstHandoffInput = {
      workSummary: 'Completed the first review candidate with full verification.',
      releaseNotes: 'Review the export progress behavior.',
      expectedUpdatedAt: updatedAt,
    };
    const concurrentHandoffs = await Promise.all([
      request(app)
        .post(`/api/v1/change-requests/${seedIds.requestApproved}/review-handoffs`)
        .set(auth(seedIds.developer))
        .send(firstHandoffInput),
      request(app)
        .post(`/api/v1/change-requests/${seedIds.requestApproved}/review-handoffs`)
        .set(auth(seedIds.owner))
        .send(firstHandoffInput),
    ]);
    expect(concurrentHandoffs.map((response) => response.status).sort()).toEqual([201, 409]);
    const handoffOne = concurrentHandoffs.find((response) => response.status === 201)!;
    expect(handoffOne.status).toBe(201);
    const firstData = (
      handoffOne.body as {
        data: {
          updatedAt: string;
          handoff: { id: string; version: number };
        };
      }
    ).data;
    expect(firstData.handoff.version).toBe(1);

    const changed = await request(app)
      .post(`/api/v1/review-handoffs/${firstData.handoff.id}/respond`)
      .set(auth(seedIds.clientAdmin))
      .send({
        decision: 'REQUEST_CHANGES',
        note: 'Please add clearer completion feedback.',
        expectedUpdatedAt: firstData.updatedAt,
      });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ data: { status: 'IN_PROGRESS' } });
    const changedAt = (changed.body as { data: { updatedAt: string } }).data.updatedAt;

    const handoffTwo = await request(app)
      .post(`/api/v1/change-requests/${seedIds.requestApproved}/review-handoffs`)
      .set(auth(seedIds.owner))
      .send({
        workSummary: 'Applied client changes and completed the final verification.',
        expectedUpdatedAt: changedAt,
      });
    const secondData = (
      handoffTwo.body as {
        data: {
          updatedAt: string;
          handoff: { id: string; version: number };
        };
      }
    ).data;
    expect(secondData.handoff.version).toBe(2);
    const responses = await Promise.all([
      request(app)
        .post(`/api/v1/review-handoffs/${secondData.handoff.id}/respond`)
        .set(auth(seedIds.clientAdmin))
        .send({
          decision: 'ACCEPT',
          note: 'Verified and accepted.',
          expectedUpdatedAt: secondData.updatedAt,
        }),
      request(app)
        .post(`/api/v1/review-handoffs/${secondData.handoff.id}/respond`)
        .set(auth(seedIds.clientAdmin))
        .send({
          decision: 'ACCEPT',
          note: 'A concurrent acceptance must lose.',
          expectedUpdatedAt: secondData.updatedAt,
        }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.status === 200)?.body).toMatchObject({
      data: { status: 'COMPLETED' },
    });
    const rows = await pool.query<{ status: string; count: string }>(
      `SELECT cr.status, count(sh.id)::text AS count
       FROM change_requests cr
       JOIN status_history sh ON sh.change_request_id = cr.id
       WHERE cr.id = $1
       GROUP BY cr.status`,
      [seedIds.requestApproved],
    );
    expect(rows.rows[0]).toMatchObject({ status: 'COMPLETED', count: '6' });
  });

  it('cancels eligible requests atomically and freezes retained estimate drafts', async () => {
    const detail = await request(app)
      .get(`/api/v1/change-requests/${seedIds.requestTwo}`)
      .set(auth(seedIds.owner));
    const updatedAt = (detail.body as { data: { updatedAt: string } }).data.updatedAt;
    const cancelled = await request(app)
      .post(`/api/v1/change-requests/${seedIds.requestTwo}/cancel`)
      .set(auth(seedIds.owner))
      .send({
        reason: 'Client confirmed this request is no longer needed.',
        expectedUpdatedAt: updatedAt,
      });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ data: { status: 'CANCELLED' } });
    const draft = await pool.query<{ id: string; updated_at: Date }>(
      'SELECT id, updated_at FROM estimates WHERE change_request_id = $1',
      [seedIds.requestTwo],
    );
    const frozen = await request(app)
      .patch(`/api/v1/estimates/${draft.rows[0]?.id}`)
      .set(auth(seedIds.developer))
      .send({
        estimatedHours: '4.50',
        hourlyRate: '125.00',
        scopeNotes: 'Retained draft cannot change after request cancellation.',
        expectedUpdatedAt: draft.rows[0]?.updated_at.toISOString(),
      });
    expect(frozen.status).toBe(409);
    const repeated = await request(app)
      .post(`/api/v1/change-requests/${seedIds.requestTwo}/cancel`)
      .set(auth(seedIds.clientAdmin))
      .send({
        reason: 'Repeated cancellation.',
        expectedUpdatedAt: (cancelled.body as { data: { updatedAt: string } }).data.updatedAt,
      });
    expect(repeated.status).toBe(409);

    const clientDetail = await request(app)
      .get(`/api/v1/change-requests/${seedIds.requestOne}`)
      .set(auth(seedIds.clientAdmin));
    const clientCancelled = await request(app)
      .post(`/api/v1/change-requests/${seedIds.requestOne}/cancel`)
      .set(auth(seedIds.clientAdmin))
      .send({
        reason: 'Client administrator cancelled this eligible request.',
        expectedUpdatedAt: (clientDetail.body as { data: { updatedAt: string } }).data.updatedAt,
      });
    expect(clientCancelled.status).toBe(200);
    expect(clientCancelled.body).toMatchObject({
      data: { status: 'CANCELLED' },
    });

    const denied = await request(app)
      .post(`/api/v1/change-requests/${seedIds.requestApproved}/cancel`)
      .set(auth(seedIds.developer))
      .send({
        reason: 'Developer cannot cancel.',
        expectedUpdatedAt: new Date().toISOString(),
      });
    expect(denied.status).toBe(403);
  });

  it('filters history sources before stable client pagination', async () => {
    const internal = await request(app)
      .get(historyPath(seedIds.requestInProgress, '?limit=50&offset=0'))
      .set(auth(seedIds.owner));
    expect(internal.status).toBe(200);
    const internalText = JSON.stringify(internal.body);
    expect(internalText).toContain('TIME_CREATED');
    expect(internalText).toContain(seedIds.activeTimeEntry);
    expect(internalText).toContain('Historical time remains attributed');

    for (const userId of [seedIds.clientAdmin, seedIds.clientMember]) {
      const client = await request(app)
        .get(historyPath(seedIds.requestInProgress, '?limit=1&offset=0'))
        .set(auth(userId));
      expect(client.status).toBe(200);
      expect(client.body).toMatchObject({
        data: [{ kind: 'STATUS_CHANGED' }],
        meta: { count: 1, limit: 1, offset: 0 },
      });
      const next = await request(app)
        .get(historyPath(seedIds.requestInProgress, '?limit=1&offset=1'))
        .set(auth(userId));
      expect(next.body).toMatchObject({
        data: [{ kind: 'STATUS_CHANGED' }],
        meta: { count: 1, limit: 1, offset: 1 },
      });
      const exhausted = await request(app)
        .get(historyPath(seedIds.requestInProgress, '?limit=1&offset=2'))
        .set(auth(userId));
      expect(exhausted.body).toMatchObject({ data: [], meta: { count: 0 } });
      const text = JSON.stringify([client.body, next.body, exhausted.body]);
      expect(text).not.toContain('TIME_');
      expect(text).not.toContain(seedIds.activeTimeEntry);
      expect(text).not.toContain('private');
    }

    const firstRead = await request(app)
      .get(historyPath(seedIds.requestReadyForReview))
      .set(auth(seedIds.clientMember));
    const secondRead = await request(app)
      .get(historyPath(seedIds.requestReadyForReview))
      .set(auth(seedIds.clientMember));
    const firstIds = (firstRead.body as { data: Array<{ id: string; kind: string }> }).data.map(
      (event) => event.id,
    );
    const secondIds = (secondRead.body as { data: Array<{ id: string; kind: string }> }).data.map(
      (event) => event.id,
    );
    expect(secondIds).toEqual(firstIds);
    const equalTimeKinds = (
      firstRead.body as {
        data: Array<{ eventTime: string; kind: string }>;
      }
    ).data
      .filter((event) => event.eventTime === '2026-07-27T12:00:00.000Z')
      .map((event) => event.kind);
    expect(equalTimeKinds).toEqual(['STATUS_CHANGED', 'WORK_HANDOFF']);
  });

  it('uses safe tenant, suspension, strict-validation, and terminal denials', async () => {
    const otherTenant = await request(app)
      .get(historyPath(seedIds.otherTenantRequest))
      .set(auth(seedIds.owner));
    expect(otherTenant.status).toBe(404);
    const internalOnly = await request(app)
      .get(historyPath(seedIds.requestInProgress))
      .set(auth(seedIds.internalOnlyUser));
    expect(internalOnly.status).toBe(404);
    const suspended = await request(app)
      .get(historyPath(seedIds.requestInProgress))
      .set(auth(seedIds.suspendedMember));
    expect(suspended.status).toBe(404);
    const missing = await request(app)
      .get(historyPath('30000000-0000-4000-8000-000000000099'))
      .set(auth(seedIds.owner));
    expect(missing.status).toBe(404);
    const strict = await request(app)
      .post(timePath(seedIds.requestInProgress))
      .set(auth(seedIds.developer))
      .send({
        durationMinutes: 30,
        description: 'Valid description.',
        workDate: '2026-02-30',
        userId: seedIds.owner,
      });
    expect(strict.status).toBe(400);
    const terminal = await request(app)
      .post(`/api/v1/change-requests/${seedIds.requestCompleted}/cancel`)
      .set(auth(seedIds.clientAdmin))
      .send({
        reason: 'Completed requests stay terminal.',
        expectedUpdatedAt: '2026-07-27T16:00:00.000Z',
      });
    expect(terminal.status).toBe(409);

    await pool.query("UPDATE projects SET status = 'ON_HOLD' WHERE id = $1", [seedIds.project]);
    const inactiveProject = await request(app)
      .get(historyPath(seedIds.requestInProgress))
      .set(auth(seedIds.owner));
    expect(inactiveProject.status).toBe(404);
    await pool.query("UPDATE projects SET status = 'ACTIVE' WHERE id = $1", [seedIds.project]);
    await pool.query("UPDATE organizations SET status = 'INACTIVE' WHERE id = $1", [
      seedIds.clientOrganization,
    ]);
    const inactiveOrganization = await request(app)
      .get(historyPath(seedIds.requestInProgress))
      .set(auth(seedIds.owner));
    expect(inactiveOrganization.status).toBe(404);
    await pool.query("UPDATE organizations SET status = 'ACTIVE' WHERE id = $1", [
      seedIds.clientOrganization,
    ]);
    await pool.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [seedIds.suspendedMember]);
    const globallySuspended = await request(app)
      .get(historyPath(seedIds.requestInProgress))
      .set(auth(seedIds.suspendedMember));
    expect(globallySuspended.status).toBe(401);
  });

  it('omits P005 free text and database detail from forced-failure logs', async () => {
    const timeSentinel = 'P005_PRIVATE_TIME_LOG_SENTINEL';
    const credentialSentinel = 'P005_CREDENTIAL_SENTINEL';
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
      CREATE FUNCTION appsolo_test_reject_time_insert()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'forced P005 insert failure with SQL parameters';
      END;
      $$
    `);
    await pool.query(`
      CREATE TRIGGER appsolo_test_reject_time_insert
      BEFORE INSERT ON time_entries
      FOR EACH ROW
      EXECUTE FUNCTION appsolo_test_reject_time_insert()
    `);

    try {
      const response = await request(loggingApp)
        .post(timePath(seedIds.requestInProgress))
        .set(auth(seedIds.developer))
        .set('authorization', `Bearer ${credentialSentinel}`)
        .set('cookie', `session=${credentialSentinel}`)
        .send({
          durationMinutes: 30,
          description: timeSentinel,
          workDate: '2026-07-27',
        });
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
    } finally {
      await pool.query('DROP TRIGGER appsolo_test_reject_time_insert ON time_entries');
      await pool.query('DROP FUNCTION appsolo_test_reject_time_insert()');
    }

    const serializedLogs = logLines.join('');
    expect(serializedLogs).toContain('unhandled request error');
    expect(serializedLogs).toContain('"err":{"type":');
    expect(serializedLogs).not.toContain(timeSentinel);
    expect(serializedLogs).not.toContain(credentialSentinel);
    expect(serializedLogs).not.toContain(databaseUrl);
    expect(serializedLogs).not.toContain('"body"');
    expect(serializedLogs).not.toContain('"params"');
    expect(serializedLogs).not.toContain('"query"');
    expect(serializedLogs).not.toContain('"stack"');
    expect(serializedLogs).not.toContain('forced P005 insert failure');
    expect(serializedLogs).not.toContain('SQL parameters');
  });
});
