import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { createDatabase, resolvedTestDatabaseUrl } from '@appsolo/database';
import { seedDatabase, seedIds } from '@appsolo/database/seed';
import {
  accessAuditEvents,
  organizationInvitations,
  organizationMemberships,
  users,
} from '@appsolo/database/schema';
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
  WEB_ACCEPTANCE_BASE_URL: 'http://localhost:4173',
  DEV_AUTH_ENABLED: true,
  APPSOLO_USE_TEST_DATABASE: false,
  REQUEST_BODY_LIMIT: '1mb',
};
const initialTestTime = new Date('2026-07-26T12:00:00.000Z');
let testTime = new Date(initialTestTime);
const app = createApp({ db, config, clock: () => new Date(testTime) });
const organizationPath = `/api/v1/organizations/${seedIds.clientOrganization}`;
const ownerHeader = { 'x-dev-user-id': seedIds.owner };
const errorBody = (body: unknown) => body as { error: { code: string; message: string } };

beforeEach(async () => {
  testTime = new Date(initialTestTime);
  await pool.query(
    'TRUNCATE TABLE access_audit_events, organization_invitations, attachments, time_entries, status_history, comments, estimates, change_requests, projects, organization_memberships, organizations, users RESTART IDENTITY CASCADE',
  );
  await seedDatabase(databaseUrl);
});
afterAll(async () => {
  await pool.end();
});

const invitationInput = (email: string) => ({
  firstName: 'Invitation',
  lastName: 'Tester',
  email,
  role: 'CLIENT_MEMBER',
});

async function createInvitation(email: string) {
  const response = await request(app)
    .post(`${organizationPath}/invitations`)
    .set(ownerHeader)
    .send(invitationInput(email));
  const body = response.body as {
    data: { invitation: { id: string; expiresAt: string }; acceptanceUrl: string };
  };
  const url = new URL(body.data.acceptanceUrl);
  const token = new URLSearchParams(url.hash.slice(1)).get('token');
  if (!token) throw new Error('Test invitation did not contain a fragment token.');
  return {
    response,
    invitationId: body.data.invitation.id,
    expiresAt: body.data.invitation.expiresAt,
    token,
    acceptanceUrl: body.data.acceptanceUrl,
  };
}

describe('P002 session and access integration', () => {
  it('signs in active users by normalized email and returns provider-neutral active session data', async () => {
    const signIn = await request(app)
      .post('/api/v1/development/session')
      .send({ email: '  ADMIN@CLIENT.TEST ' });
    expect(signIn.status).toBe(200);
    expect(signIn.body).toMatchObject({
      data: {
        user: { id: seedIds.clientAdmin, email: 'admin@client.test' },
        memberships: [
          {
            organizationId: seedIds.clientOrganization,
            role: 'CLIENT_ADMIN',
            status: 'ACTIVE',
          },
        ],
      },
    });
    expect(JSON.stringify(signIn.body)).not.toContain('x-dev-user-id');

    const session = await request(app).get('/api/v1/session').set(ownerHeader);
    expect(session.status).toBe(200);
    expect(
      (session.body as { data: { memberships: Array<{ capabilities: string[] }> } }).data.memberships
        .flatMap((membership) => membership.capabilities)
        .includes('MANAGE_INVITATIONS'),
    ).toBe(true);

    const invited = await request(app)
      .post('/api/v1/development/session')
      .send({ email: 'pending-invitee@client.test' });
    await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, seedIds.suspendedMember));
    const memberList = await request(app).get(`${organizationPath}/members`).set(ownerHeader);
    const globallySuspendedMember = (
      memberList.body as {
        data: Array<{ userId: string; capabilities: string[] }>;
      }
    ).data.find((member) => member.userId === seedIds.suspendedMember);
    expect(globallySuspendedMember?.capabilities).toEqual([]);
    const suspended = await request(app)
      .post('/api/v1/development/session')
      .send({ email: 'suspended-member@client.test' });
    const unknown = await request(app)
      .post('/api/v1/development/session')
      .send({ email: 'unknown@client.test' });
    expect([invited.status, suspended.status, unknown.status]).toEqual([401, 401, 401]);
    expect(errorBody(invited.body).error.message).toBe(errorBody(unknown.body).error.message);
  });

  it('enforces role ceilings, organization type, tenant scope, and strict write contracts', async () => {
    const clientAdminInvite = await request(app)
      .post(`${organizationPath}/invitations`)
      .set('x-dev-user-id', seedIds.clientAdmin)
      .send(invitationInput('allowed-client-member@client.test'));
    const elevatedInvite = await request(app)
      .post(`${organizationPath}/invitations`)
      .set('x-dev-user-id', seedIds.clientAdmin)
      .send({ ...invitationInput('forbidden-developer@client.test'), role: 'DEVELOPER' });
    const developerList = await request(app)
      .get(`${organizationPath}/members`)
      .set('x-dev-user-id', seedIds.developer);
    const crossTenant = await request(app)
      .get(`/api/v1/organizations/${seedIds.otherClientOrganization}/members`)
      .set(ownerHeader);
    const unknownField = await request(app)
      .post(`${organizationPath}/invitations`)
      .set(ownerHeader)
      .send({ ...invitationInput('unknown-field@client.test'), unexpected: true });
    const internalClientRole = await request(app)
      .post(`/api/v1/organizations/${seedIds.internalOrganization}/invitations`)
      .set(ownerHeader)
      .send(invitationInput('internal-client-role@appsolo.test'));
    await db
      .update(organizationMemberships)
      .set({ status: 'SUSPENDED' })
      .where(
        and(
          eq(organizationMemberships.organizationId, seedIds.clientOrganization),
          eq(organizationMemberships.userId, seedIds.developer),
        ),
      );
    const suspendedHigherRole = await request(app)
      .post(`${organizationPath}/invitations`)
      .set('x-dev-user-id', seedIds.clientAdmin)
      .send({
        ...invitationInput('developer@appsolo.test'),
        role: 'CLIENT_MEMBER',
      });
    const crossTenantInvitationId = await request(app)
      .post(
        `/api/v1/organizations/${seedIds.internalOrganization}/invitations/${seedIds.pendingInvitation}/resend`,
      )
      .set(ownerHeader)
      .send({});
    const crossTenantMembershipId = await request(app)
      .patch(`${organizationPath}/memberships/40000000-0000-4000-8000-000000000007`)
      .set(ownerHeader)
      .send({
        status: 'SUSPENDED',
        expectedUpdatedAt: '2026-07-26T12:00:00.000Z',
      });
    expect(clientAdminInvite.status).toBe(201);
    expect(elevatedInvite.status).toBe(403);
    expect(developerList.status).toBe(403);
    expect(crossTenant.status).toBe(403);
    expect(unknownField.status).toBe(400);
    expect(internalClientRole.status).toBe(403);
    expect(suspendedHigherRole.status).toBe(403);
    expect(crossTenantInvitationId.status).toBe(404);
    expect(errorBody(crossTenantInvitationId.body).error.code).toBe('NOT_FOUND');
    expect(crossTenantMembershipId.status).toBe(404);
    expect(errorBody(crossTenantMembershipId.body).error.code).toBe('NOT_FOUND');
  });

  it('stores only a SHA-256 token hash, prevents duplicate pending invitations, and reuses active profiles', async () => {
    const created = await createInvitation('new-token-user@client.test');
    expect(created.response.status).toBe(201);
    expect(created.token.length).toBeGreaterThanOrEqual(43);
    expect(created.acceptanceUrl).toContain('#token=');
    expect(created.acceptanceUrl).not.toContain('?token=');
    expect(created.acceptanceUrl).toMatch(/^http:\/\/localhost:4173\/invitations\/accept#/);

    const row = await db.query.organizationInvitations.findFirst({
      where: (invitation, operators) => operators.eq(invitation.id, created.invitationId),
    });
    expect(row?.tokenHash).toBe(createHash('sha256').update(created.token, 'utf8').digest('hex'));
    expect(row?.authorizedByRole).toBe('OWNER');
    expect(JSON.stringify(created.response.body)).not.toContain(row?.tokenHash);
    expect(JSON.stringify(row)).not.toContain(created.token);
    const newUser = await db.query.users.findFirst({
      where: (user, operators) => operators.eq(user.email, 'new-token-user@client.test'),
    });
    expect(newUser?.status).toBe('INVITED');

    const concurrent = await Promise.all([
      request(app)
        .post(`${organizationPath}/invitations`)
        .set(ownerHeader)
        .send(invitationInput('concurrent@client.test')),
      request(app)
        .post(`${organizationPath}/invitations`)
        .set(ownerHeader)
        .send(invitationInput('concurrent@client.test')),
    ]);
    expect(concurrent.map((response) => response.status).sort()).toEqual([201, 409]);
    const concurrentRows = await db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, seedIds.clientOrganization),
          eq(organizationInvitations.email, 'concurrent@client.test'),
          eq(organizationInvitations.status, 'PENDING'),
        ),
      );
    expect(concurrentRows).toHaveLength(1);

    const existing = await request(app).post(`${organizationPath}/invitations`).set(ownerHeader).send({
      firstName: 'Overwritten',
      lastName: 'Name',
      email: 'member@client.test',
      role: 'CLIENT_MEMBER',
    });
    expect(existing.status).toBe(409);
    const member = await db.query.users.findFirst({
      where: (user, operators) => operators.eq(user.id, seedIds.clientMember),
    });
    expect(member).toMatchObject({ firstName: 'Morgan', lastName: 'Member' });

    await db.insert(organizationMemberships).values({
      id: '40000000-0000-4000-8000-000000000099',
      userId: seedIds.owner,
      organizationId: seedIds.otherClientOrganization,
      role: 'OWNER',
    });
    const reused = await request(app)
      .post(`/api/v1/organizations/${seedIds.otherClientOrganization}/invitations`)
      .set(ownerHeader)
      .send({
        firstName: 'Must not',
        lastName: 'Overwrite',
        email: 'member@client.test',
        role: 'CLIENT_MEMBER',
      });
    expect(reused.status).toBe(201);
    expect(
      (reused.body as { data: { invitation: { invitedUserId: string } } }).data.invitation.invitedUserId,
    ).toBe(seedIds.clientMember);
    const unchanged = await db.query.users.findFirst({
      where: (user, operators) => operators.eq(user.id, seedIds.clientMember),
    });
    expect(unchanged).toMatchObject({ firstName: 'Morgan', lastName: 'Member' });

    await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, seedIds.suspendedMember));
    const globallySuspended = await request(app)
      .post(`/api/v1/organizations/${seedIds.otherClientOrganization}/invitations`)
      .set(ownerHeader)
      .send(invitationInput('suspended-member@client.test'));
    expect(globallySuspended.status).toBe(409);
  });

  it('rotates, revokes, expires, and accepts invitation tokens with stable safe errors', async () => {
    const rotated = await createInvitation('rotated@client.test');
    expect(rotated.expiresAt).toBe('2026-08-02T12:00:00.000Z');
    testTime = new Date('2026-07-27T12:00:00.000Z');
    const resend = await request(app)
      .post(`${organizationPath}/invitations/${rotated.invitationId}/resend`)
      .set(ownerHeader)
      .send({});
    const resentBody = resend.body as {
      data: { invitation: { expiresAt: string }; acceptanceUrl: string };
    };
    const resentUrl = new URL(resentBody.data.acceptanceUrl);
    const newToken = new URLSearchParams(resentUrl.hash.slice(1)).get('token');
    expect(resend.status).toBe(200);
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(rotated.token);
    expect(resentBody.data.invitation.expiresAt).toBe('2026-08-03T12:00:00.000Z');
    const oldToken = await request(app).post('/api/v1/invitations/accept').send({ token: rotated.token });
    expect(oldToken.status).toBe(400);
    expect(errorBody(oldToken.body).error.code).toBe('INVITATION_INVALID');

    const revoked = await createInvitation('revoked@client.test');
    expect(
      (
        await request(app)
          .post(`${organizationPath}/invitations/${revoked.invitationId}/revoke`)
          .set(ownerHeader)
          .send({})
      ).status,
    ).toBe(200);
    const revokedAcceptance = await request(app)
      .post('/api/v1/invitations/accept')
      .send({ token: revoked.token });
    expect(revokedAcceptance.status).toBe(400);
    expect(errorBody(revokedAcceptance.body).error.code).toBe('INVITATION_INVALID');

    const expired = await createInvitation('expired@client.test');
    await db
      .update(organizationInvitations)
      .set({ expiresAt: new Date('2000-01-01T00:00:00.000Z') })
      .where(eq(organizationInvitations.id, expired.invitationId));
    const invitationList = await request(app).get(`${organizationPath}/invitations`).set(ownerHeader);
    const listedInvitations = (invitationList.body as { data: Array<{ id: string; status: string }> }).data;
    expect(listedInvitations.find((invitation) => invitation.id === expired.invitationId)?.status).toBe(
      'EXPIRED',
    );
    const expiredAcceptance = await request(app)
      .post('/api/v1/invitations/accept')
      .send({ token: expired.token });
    expect(expiredAcceptance.status).toBe(410);
    expect(errorBody(expiredAcceptance.body).error.code).toBe('INVITATION_EXPIRED');

    if (!newToken) throw new Error('Resend did not return a token.');
    const accepted = await request(app).post('/api/v1/invitations/accept').send({ token: newToken });
    expect(accepted.status).toBe(200);
    expect((accepted.body as { data: { user: { email: string } } }).data.user.email).toBe(
      'rotated@client.test',
    );
    const repeated = await request(app).post('/api/v1/invitations/accept').send({ token: newToken });
    expect(repeated.status).toBe(400);
    expect(errorBody(repeated.body).error.code).toBe('INVITATION_INVALID');

    const reactivation = await createInvitation('suspended-member@client.test');
    const reactivated = await request(app)
      .post('/api/v1/invitations/accept')
      .send({ token: reactivation.token });
    expect(reactivated.status).toBe(200);
    const membership = await db.query.organizationMemberships.findFirst({
      where: (row, operators) =>
        operators.and(
          operators.eq(row.userId, seedIds.suspendedMember),
          operators.eq(row.organizationId, seedIds.clientOrganization),
        ),
    });
    expect(membership).toMatchObject({ status: 'ACTIVE', role: 'CLIENT_MEMBER' });
  });

  it('revalidates the stored inviter ceiling against target membership state at acceptance', async () => {
    const created = await request(app)
      .post(`${organizationPath}/invitations`)
      .set('x-dev-user-id', seedIds.clientAdmin)
      .send(invitationInput('late-higher-role@client.test'));
    expect(created.status).toBe(201);
    const createdBody = created.body as {
      data: { invitation: { id: string }; acceptanceUrl: string };
    };
    const acceptanceUrl = createdBody.data.acceptanceUrl;
    const token = new URLSearchParams(new URL(acceptanceUrl).hash.slice(1)).get('token');
    if (!token) throw new Error('Test invitation did not contain a fragment token.');

    const invitedUser = await db.query.users.findFirst({
      where: (row, operators) => operators.eq(row.email, 'late-higher-role@client.test'),
    });
    if (!invitedUser) throw new Error('Invited user was not created.');
    await db.insert(organizationMemberships).values({
      organizationId: seedIds.clientOrganization,
      userId: invitedUser.id,
      role: 'DEVELOPER',
      status: 'SUSPENDED',
    });

    const acceptance = await request(app).post('/api/v1/invitations/accept').send({ token });
    expect(acceptance.status).toBe(400);
    expect(errorBody(acceptance.body).error.code).toBe('INVITATION_INVALID');
    const membership = await db.query.organizationMemberships.findFirst({
      where: (row, operators) =>
        operators.and(
          operators.eq(row.organizationId, seedIds.clientOrganization),
          operators.eq(row.userId, invitedUser.id),
        ),
    });
    expect(membership).toMatchObject({ status: 'SUSPENDED', role: 'DEVELOPER' });
  });

  it('survives inviter demotion and reanchors an authorized resend after suspension', async () => {
    const createAsClientAdmin = async (email: string) => {
      const response = await request(app)
        .post(`${organizationPath}/invitations`)
        .set('x-dev-user-id', seedIds.clientAdmin)
        .send(invitationInput(email));
      expect(response.status).toBe(201);
      const body = response.body as {
        data: { invitation: { id: string }; acceptanceUrl: string };
      };
      const token = new URLSearchParams(new URL(body.data.acceptanceUrl).hash.slice(1)).get('token');
      if (!token) throw new Error('Test invitation did not contain a fragment token.');
      return { invitationId: body.data.invitation.id, token };
    };
    const directAcceptance = await createAsClientAdmin('suspended-inviter-direct@client.test');
    const repairedByResend = await createAsClientAdmin('suspended-inviter-resend@client.test');
    const clientAdminMembership = await db.query.organizationMemberships.findFirst({
      where: (row, operators) =>
        operators.and(
          operators.eq(row.organizationId, seedIds.clientOrganization),
          operators.eq(row.userId, seedIds.clientAdmin),
        ),
    });
    if (!clientAdminMembership) throw new Error('Client administrator membership was not found.');
    const demotion = await request(app)
      .patch(`${organizationPath}/memberships/${clientAdminMembership.id}`)
      .set(ownerHeader)
      .send({
        role: 'CLIENT_MEMBER',
        expectedUpdatedAt: clientAdminMembership.updatedAt.toISOString(),
      });
    expect(demotion.status).toBe(200);

    const acceptedWithoutLiveInviter = await request(app)
      .post('/api/v1/invitations/accept')
      .send({ token: directAcceptance.token });
    expect(acceptedWithoutLiveInviter.status).toBe(200);

    const suspension = await request(app)
      .patch(`${organizationPath}/memberships/${clientAdminMembership.id}`)
      .set(ownerHeader)
      .send({
        status: 'SUSPENDED',
        expectedUpdatedAt: (demotion.body as { data: { updatedAt: string } }).data.updatedAt,
      });
    expect(suspension.status).toBe(200);

    const resend = await request(app)
      .post(`${organizationPath}/invitations/${repairedByResend.invitationId}/resend`)
      .set(ownerHeader)
      .send({});
    expect(resend.status).toBe(200);
    const resentUrl = (resend.body as { data: { acceptanceUrl: string } }).data.acceptanceUrl;
    const resentToken = new URLSearchParams(new URL(resentUrl).hash.slice(1)).get('token');
    if (!resentToken) throw new Error('Resend did not return a fragment token.');
    const reanchored = await db.query.organizationInvitations.findFirst({
      where: (row, operators) => operators.eq(row.id, repairedByResend.invitationId),
    });
    expect(reanchored).toMatchObject({
      invitedByUserId: seedIds.owner,
      authorizedByRole: 'OWNER',
    });
    const acceptedAfterResend = await request(app)
      .post('/api/v1/invitations/accept')
      .send({ token: resentToken });
    expect(acceptedAfterResend.status).toBe(200);
  });

  it('allows at most one concurrent acceptance and atomically creates membership and audit history', async () => {
    const created = await createInvitation('concurrent-accept@client.test');
    const responses = await Promise.all([
      request(app).post('/api/v1/invitations/accept').send({ token: created.token }),
      request(app).post('/api/v1/invitations/accept').send({ token: created.token }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    const user = await db.query.users.findFirst({
      where: (row, operators) => operators.eq(row.email, 'concurrent-accept@client.test'),
    });
    expect(user?.status).toBe('ACTIVE');
    if (!user) throw new Error('Accepted user was not found.');
    const memberships = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, user.id),
          eq(organizationMemberships.organizationId, seedIds.clientOrganization),
        ),
      );
    expect(memberships).toHaveLength(1);
    const events = await db
      .select()
      .from(accessAuditEvents)
      .where(
        and(
          eq(accessAuditEvents.invitationId, created.invitationId),
          eq(accessAuditEvents.eventType, 'INVITATION_ACCEPTED'),
        ),
      );
    expect(events).toHaveLength(1);
  });

  it('suspends and reactivates membership immediately, protects owners, and rejects stale changes', async () => {
    const members = await request(app).get(`${organizationPath}/members`).set(ownerHeader);
    const rows = (
      members.body as {
        data: Array<{
          membershipId: string;
          userId: string;
          updatedAt: string;
          status: string;
        }>;
      }
    ).data;
    const clientMember = rows.find((member) => member.userId === seedIds.clientMember);
    const owner = rows.find((member) => member.userId === seedIds.owner);
    if (!clientMember || !owner) throw new Error('Seed members were not returned.');

    const suspended = await request(app)
      .patch(`${organizationPath}/memberships/${clientMember.membershipId}`)
      .set(ownerHeader)
      .send({ status: 'SUSPENDED', expectedUpdatedAt: clientMember.updatedAt });
    expect(suspended.status).toBe(200);
    const projectDenied = await request(app)
      .get(`/api/v1/projects/${seedIds.project}/change-requests`)
      .set('x-dev-user-id', seedIds.clientMember);
    expect(projectDenied.status).toBe(403);
    const sessionAfterSuspension = await request(app)
      .get('/api/v1/session')
      .set('x-dev-user-id', seedIds.clientMember);
    expect(sessionAfterSuspension.status).toBe(200);
    expect(
      (sessionAfterSuspension.body as { data: { memberships: unknown[] } }).data.memberships,
    ).toHaveLength(0);

    const reactivated = await request(app)
      .patch(`${organizationPath}/memberships/${clientMember.membershipId}`)
      .set(ownerHeader)
      .send({
        status: 'ACTIVE',
        expectedUpdatedAt: (suspended.body as { data: { updatedAt: string } }).data.updatedAt,
      });
    expect(reactivated.status).toBe(200);
    expect(
      (
        await request(app)
          .get(`/api/v1/projects/${seedIds.project}/change-requests`)
          .set('x-dev-user-id', seedIds.clientMember)
      ).status,
    ).toBe(200);

    const stale = await request(app)
      .patch(`${organizationPath}/memberships/${clientMember.membershipId}`)
      .set(ownerHeader)
      .send({ role: 'CLIENT_ADMIN', expectedUpdatedAt: clientMember.updatedAt });
    expect(stale.status).toBe(409);
    const selfSuspend = await request(app)
      .patch(`${organizationPath}/memberships/${owner.membershipId}`)
      .set(ownerHeader)
      .send({ status: 'SUSPENDED', expectedUpdatedAt: owner.updatedAt });
    const lastOwnerDemotion = await request(app)
      .patch(`${organizationPath}/memberships/${owner.membershipId}`)
      .set(ownerHeader)
      .send({ role: 'ADMIN', expectedUpdatedAt: owner.updatedAt });
    expect(selfSuspend.status).toBe(409);
    expect(lastOwnerDemotion.status).toBe(409);
  });

  it('returns tenant-scoped newest-first audit DTOs without token or arbitrary metadata', async () => {
    const created = await createInvitation('audit@client.test');
    await request(app)
      .post(`${organizationPath}/invitations/${created.invitationId}/revoke`)
      .set(ownerHeader)
      .send({});
    const response = await request(app)
      .get(`${organizationPath}/access-events?limit=10&offset=0`)
      .set(ownerHeader);
    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(created.token);
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('metadata');
    const events = (response.body as { data: Array<{ createdAt: string }> }).data;
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.createdAt)).toEqual(
      [...events]
        .map((event) => event.createdAt)
        .sort()
        .reverse(),
    );
    const denied = await request(app)
      .get(`${organizationPath}/access-events`)
      .set('x-dev-user-id', seedIds.otherTenantUser);
    expect(denied.status).toBe(403);
  });
});
