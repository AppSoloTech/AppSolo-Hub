import { createDatabase, resolvedTestDatabaseUrl } from '@appsolo/database';
import { seedDatabase, seedIds } from '@appsolo/database/seed';
import { changeRequests, estimateResponses, estimates, statusHistory, users } from '@appsolo/database/schema';
import { and, eq } from 'drizzle-orm';
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
const auth = (userId: string) => ({ 'x-dev-user-id': userId });
const listPath = (requestId: string) => `/api/v1/change-requests/${requestId}/estimates`;
const validTerms = {
  estimatedHours: '1.50',
  hourlyRate: '0.01',
  scopeNotes: 'Implement the exact approved estimate scope.',
};

beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE estimate_responses, access_audit_events, organization_invitations, attachments, time_entries, status_history, comments, estimates, change_requests, projects, organization_memberships, organizations, users RESTART IDENTITY CASCADE',
  );
  await seedDatabase(databaseUrl);
});
afterAll(async () => {
  await pool.end();
});

describe('estimate API integration', () => {
  it('exposes the exact centralized capability matrix in sessions', async () => {
    const users = [
      [seedIds.owner, ['VIEW_ESTIMATES', 'MANAGE_ESTIMATES']],
      [seedIds.developer, ['VIEW_ESTIMATES', 'MANAGE_ESTIMATES']],
      [seedIds.clientAdmin, ['VIEW_ESTIMATES', 'RESPOND_TO_ESTIMATES']],
      [seedIds.clientMember, ['VIEW_ESTIMATES']],
    ] as const;
    for (const [userId, expected] of users) {
      const response = await request(app).get('/api/v1/session').set(auth(userId));
      const body = response.body as {
        data: { memberships: Array<{ organizationId: string; capabilities: string[] }> };
      };
      const clientMembership = body.data.memberships.find(
        (membership) => membership.organizationId === seedIds.clientOrganization,
      );
      expect(clientMembership?.capabilities).toEqual(expect.arrayContaining([...expected]));
    }
    const clientAdmin = await request(app).get('/api/v1/session').set(auth(seedIds.clientAdmin));
    expect(JSON.stringify(clientAdmin.body)).not.toContain('MANAGE_ESTIMATES');
    const developer = await request(app).get('/api/v1/session').set(auth(seedIds.developer));
    expect(JSON.stringify(developer.body)).not.toContain('RESPOND_TO_ESTIMATES');
  });

  it('keeps drafts completely absent for client roles while managers receive exact terms', async () => {
    const manager = await request(app).get(listPath(seedIds.requestTwo)).set(auth(seedIds.developer));
    const managerBody = manager.body as { data: Array<{ status: string; estimatedCost: string }> };
    expect(manager.status).toBe(200);
    expect(managerBody.data).toEqual([expect.objectContaining({ status: 'DRAFT', estimatedCost: '562.50' })]);

    for (const userId of [seedIds.clientAdmin, seedIds.clientMember]) {
      const client = await request(app).get(listPath(seedIds.requestTwo)).set(auth(userId));
      expect(client.status).toBe(200);
      expect(client.body).toMatchObject({ data: [], meta: { count: 0 } });
      expect(JSON.stringify(client.body)).not.toContain('562.50');
    }
  });

  it('creates one server-numbered exact draft and atomically advances a submitted request', async () => {
    const overflow = await request(app).post(listPath(seedIds.requestOne)).set(auth(seedIds.developer)).send({
      estimatedHours: '999999.99',
      hourlyRate: '9999999999.99',
      scopeNotes: 'This otherwise valid request exceeds the stored cost range.',
    });
    expect(overflow.status).toBe(400);
    expect(overflow.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ path: 'estimatedCost', message: 'The calculated cost is too large.' }],
      },
    });

    const response = await request(app)
      .post(listPath(seedIds.requestOne))
      .set(auth(seedIds.developer))
      .send(validTerms);
    const body = response.body as {
      data: {
        version: number;
        estimatedHours: string;
        hourlyRate: string;
        estimatedCost: string;
        status: string;
      };
    };
    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({
      version: 1,
      estimatedHours: '1.50',
      hourlyRate: '0.01',
      estimatedCost: '0.02',
      status: 'DRAFT',
    });
    const history = await db
      .select()
      .from(statusHistory)
      .where(
        and(
          eq(statusHistory.changeRequestId, seedIds.requestOne),
          eq(statusHistory.newStatus, 'AWAITING_ESTIMATE'),
        ),
      );
    expect(history).toHaveLength(1);

    const forbidden = await request(app)
      .post(listPath(seedIds.requestAwaitingApproval))
      .set(auth(seedIds.clientAdmin))
      .send(validTerms);
    expect(forbidden.status).toBe(403);
    const strict = await request(app)
      .post(listPath(seedIds.requestOne))
      .set(auth(seedIds.developer))
      .send({ ...validTerms, estimatedCost: '0.02', status: 'DRAFT' });
    expect(strict.status).toBe(400);
    const unknownQuery = await request(app)
      .get(`${listPath(seedIds.requestOne)}?includeDraft=true`)
      .set(auth(seedIds.developer));
    expect(unknownQuery.status).toBe(400);
  });

  it('denies client-member create, edit, and submit operations without exposing draft state', async () => {
    const draftList = await request(app).get(listPath(seedIds.requestTwo)).set(auth(seedIds.developer));
    const draft = (draftList.body as { data: Array<{ id: string; updatedAt: string }> }).data[0];
    expect(draft).toBeDefined();

    const createDenied = await request(app)
      .post(listPath(seedIds.requestOne))
      .set(auth(seedIds.clientMember))
      .send(validTerms);
    expect(createDenied.status).toBe(403);

    const editDenied = await request(app)
      .patch(`/api/v1/estimates/${draft?.id}`)
      .set(auth(seedIds.clientMember))
      .send({ ...validTerms, expectedUpdatedAt: draft?.updatedAt });
    expect(editDenied.status).toBe(404);

    const submitDenied = await request(app)
      .post(`/api/v1/estimates/${draft?.id}/submit`)
      .set(auth(seedIds.clientMember))
      .send({ expectedUpdatedAt: draft?.updatedAt });
    expect(submitDenied.status).toBe(404);
    expect(JSON.stringify([editDenied.body, submitDenied.body])).not.toContain(draft?.id);
  });

  it('serializes concurrent draft creation and preserves the single transition', async () => {
    const calls = await Promise.all([
      request(app).post(listPath(seedIds.requestOne)).set(auth(seedIds.owner)).send(validTerms),
      request(app).post(listPath(seedIds.requestOne)).set(auth(seedIds.owner)).send(validTerms),
    ]);
    expect(calls.map((call) => call.status).sort()).toEqual([201, 409]);
    const drafts = await db
      .select()
      .from(estimates)
      .where(and(eq(estimates.changeRequestId, seedIds.requestOne), eq(estimates.status, 'DRAFT')));
    expect(drafts).toHaveLength(1);
    const transitions = await db
      .select()
      .from(statusHistory)
      .where(
        and(
          eq(statusHistory.changeRequestId, seedIds.requestOne),
          eq(statusHistory.newStatus, 'AWAITING_ESTIMATE'),
        ),
      );
    expect(transitions).toHaveLength(1);
  });

  it('recalculates edits and rejects stale state without overwriting newer terms', async () => {
    const list = await request(app).get(listPath(seedIds.requestTwo)).set(auth(seedIds.developer));
    const draft = (list.body as { data: Array<{ id: string; updatedAt: string }> }).data[0];
    expect(draft).toBeDefined();
    const first = await request(app)
      .patch(`/api/v1/estimates/${draft?.id}`)
      .set(auth(seedIds.developer))
      .send({
        estimatedHours: '2.25',
        hourlyRate: '100.00',
        scopeNotes: 'Updated complete scope for the estimate.',
        expectedUpdatedAt: draft?.updatedAt,
      });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ data: { estimatedCost: '225.00' } });
    const stale = await request(app)
      .patch(`/api/v1/estimates/${draft?.id}`)
      .set(auth(seedIds.developer))
      .send({
        estimatedHours: '9.00',
        hourlyRate: '100.00',
        scopeNotes: 'A stale edit that must never overwrite terms.',
        expectedUpdatedAt: draft?.updatedAt,
      });
    expect(stale.status).toBe(409);
    const persisted = await request(app).get(listPath(seedIds.requestTwo)).set(auth(seedIds.developer));
    expect(persisted.body).toMatchObject({ data: [{ estimatedCost: '225.00' }] });
  });

  it('submits immutable terms and allows exactly one client-admin response', async () => {
    const list = await request(app).get(listPath(seedIds.requestTwo)).set(auth(seedIds.developer));
    const draft = (list.body as { data: Array<{ id: string; updatedAt: string }> }).data[0];
    const submitted = await request(app)
      .post(`/api/v1/estimates/${draft?.id}/submit`)
      .set(auth(seedIds.developer))
      .send({ expectedUpdatedAt: draft?.updatedAt });
    const submittedBody = submitted.body as { data: { id: string; updatedAt: string } };
    expect(submitted.status).toBe(200);
    expect(submitted.body).toMatchObject({
      data: { status: 'SUBMITTED', estimatedCost: '562.50' },
    });

    const clientView = await request(app).get(listPath(seedIds.requestTwo)).set(auth(seedIds.clientMember));
    expect(clientView.body).toMatchObject({ data: [{ status: 'SUBMITTED', estimatedCost: '562.50' }] });
    const edit = await request(app)
      .patch(`/api/v1/estimates/${submittedBody.data.id}`)
      .set(auth(seedIds.developer))
      .send({ ...validTerms, expectedUpdatedAt: submittedBody.data.updatedAt });
    expect(edit.status).toBe(409);
    const developerResponse = await request(app)
      .post(`/api/v1/estimates/${submittedBody.data.id}/respond`)
      .set(auth(seedIds.developer))
      .send({ decision: 'APPROVE', expectedUpdatedAt: submittedBody.data.updatedAt });
    expect(developerResponse.status).toBe(404);

    const responses = await Promise.all([
      request(app)
        .post(`/api/v1/estimates/${submittedBody.data.id}/respond`)
        .set(auth(seedIds.clientAdmin))
        .send({
          decision: 'APPROVE',
          note: 'Approved for delivery.',
          expectedUpdatedAt: submittedBody.data.updatedAt,
        }),
      request(app)
        .post(`/api/v1/estimates/${submittedBody.data.id}/respond`)
        .set(auth(seedIds.clientAdmin))
        .send({
          decision: 'APPROVE',
          note: 'Duplicate approval attempt.',
          expectedUpdatedAt: submittedBody.data.updatedAt,
        }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const durableResponses = await db
      .select()
      .from(estimateResponses)
      .where(eq(estimateResponses.estimateId, submittedBody.data.id));
    expect(durableResponses).toHaveLength(1);
    const responseTransitions = await db
      .select()
      .from(statusHistory)
      .where(
        and(
          eq(statusHistory.changeRequestId, seedIds.requestTwo),
          eq(statusHistory.previousStatus, 'AWAITING_APPROVAL'),
        ),
      );
    expect(responseTransitions).toHaveLength(1);
    expect(responseTransitions[0]?.newStatus).toBe('APPROVED');
  });

  it('requires rejection and clarification reasons and supersedes only the prior revision', async () => {
    const actionable = await request(app)
      .get(listPath(seedIds.requestAwaitingApproval))
      .set(auth(seedIds.clientAdmin));
    const submitted = (actionable.body as { data: Array<{ id: string; updatedAt: string }> }).data[0];
    const invalid = await request(app)
      .post(`/api/v1/estimates/${submitted?.id}/respond`)
      .set(auth(seedIds.clientAdmin))
      .send({ decision: 'REJECT', note: ' ', expectedUpdatedAt: submitted?.updatedAt });
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post(listPath(seedIds.requestClarification))
      .set(auth(seedIds.owner))
      .send({
        estimatedHours: '2.00',
        hourlyRate: '150.00',
        scopeNotes: 'Revised alert thresholds after client clarification.',
      });
    const revision = (created.body as { data: { id: string; version: number; updatedAt: string } }).data;
    expect(revision.version).toBe(2);
    const submit = await request(app)
      .post(`/api/v1/estimates/${revision.id}/submit`)
      .set(auth(seedIds.owner))
      .send({ expectedUpdatedAt: revision.updatedAt });
    expect(submit.status).toBe(200);
    const history = await request(app)
      .get(listPath(seedIds.requestClarification))
      .set(auth(seedIds.clientAdmin));
    expect(history.body).toMatchObject({
      data: [
        { version: 2, status: 'SUBMITTED' },
        {
          version: 1,
          status: 'SUPERSEDED',
          response: { decision: 'CLARIFICATION_REQUESTED' },
        },
      ],
    });
  });

  it('persists real rejection and clarification decisions with one response and transition each', async () => {
    const rejectView = await request(app)
      .get(listPath(seedIds.requestAwaitingApproval))
      .set(auth(seedIds.clientAdmin));
    const rejectable = (rejectView.body as { data: Array<{ id: string; updatedAt: string }> }).data[0];
    const rejected = await request(app)
      .post(`/api/v1/estimates/${rejectable?.id}/respond`)
      .set(auth(seedIds.clientAdmin))
      .send({
        decision: 'REJECT',
        note: 'Exclude archived filter presets.',
        expectedUpdatedAt: rejectable?.updatedAt,
      });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({
      data: {
        status: 'REJECTED',
        response: { decision: 'REJECTED', note: 'Exclude archived filter presets.' },
      },
    });

    const clarificationView = await request(app)
      .get(listPath(seedIds.requestRevision))
      .set(auth(seedIds.clientAdmin));
    const clarifiable = (
      clarificationView.body as {
        data: Array<{ id: string; status: string; updatedAt: string }>;
      }
    ).data.find((estimate) => estimate.status === 'SUBMITTED');
    const clarified = await request(app)
      .post(`/api/v1/estimates/${clarifiable?.id}/respond`)
      .set(auth(seedIds.clientAdmin))
      .send({
        decision: 'REQUEST_CLARIFICATION',
        note: 'Confirm whether regional totals include archived accounts.',
        expectedUpdatedAt: clarifiable?.updatedAt,
      });
    expect(clarified.status).toBe(200);
    expect(clarified.body).toMatchObject({
      data: {
        status: 'NEEDS_CLARIFICATION',
        response: {
          decision: 'CLARIFICATION_REQUESTED',
          note: 'Confirm whether regional totals include archived accounts.',
        },
      },
    });

    for (const expected of [
      {
        requestId: seedIds.requestAwaitingApproval,
        estimateId: seedIds.submittedEstimate,
        requestStatus: 'REJECTED',
      },
      {
        requestId: seedIds.requestRevision,
        estimateId: seedIds.revisionEstimate,
        requestStatus: 'NEEDS_CLARIFICATION',
      },
    ] as const) {
      const responseRows = await db
        .select()
        .from(estimateResponses)
        .where(eq(estimateResponses.estimateId, expected.estimateId));
      expect(responseRows).toHaveLength(1);
      const transitionRows = await db
        .select()
        .from(statusHistory)
        .where(
          and(
            eq(statusHistory.changeRequestId, expected.requestId),
            eq(statusHistory.previousStatus, 'AWAITING_APPROVAL'),
            eq(statusHistory.newStatus, expected.requestStatus),
          ),
        );
      expect(transitionRows).toHaveLength(1);
      const [requestRow] = await db
        .select({ status: changeRequests.status })
        .from(changeRequests)
        .where(eq(changeRequests.id, expected.requestId));
      expect(requestRow?.status).toBe(expected.requestStatus);
      const [estimateRow] = await db
        .select({ status: estimates.status })
        .from(estimates)
        .where(eq(estimates.id, expected.estimateId));
      expect(estimateRow?.status).toBe(expected.requestStatus);
    }
  });

  it('retains response history when a responder name component is empty', async () => {
    await db.update(users).set({ firstName: '' }).where(eq(users.id, seedIds.clientAdmin));
    const history = await request(app).get(listPath(seedIds.requestApproved)).set(auth(seedIds.clientMember));
    expect(history.status).toBe(200);
    expect(history.body).toMatchObject({
      data: [
        {
          status: 'APPROVED',
          response: { decision: 'APPROVED', actorDisplayName: 'Admin' },
        },
      ],
    });
  });

  it('uses safe not-found behavior for cross-tenant and suspended identifier access', async () => {
    for (const userId of [seedIds.otherTenantUser, seedIds.internalOnlyUser, seedIds.suspendedMember]) {
      const list = await request(app).get(listPath(seedIds.requestOne)).set(auth(userId));
      expect(list.status).toBe(404);
      expect(list.body).not.toHaveProperty('data');
      const mutation = await request(app)
        .post(`/api/v1/estimates/${seedIds.submittedEstimate}/respond`)
        .set(auth(userId))
        .send({ decision: 'APPROVE', expectedUpdatedAt: '2026-07-26T14:00:00.000Z' });
      expect(mutation.status).toBe(404);
      expect(JSON.stringify(mutation.body)).not.toContain(seedIds.submittedEstimate);
    }
  });
});
