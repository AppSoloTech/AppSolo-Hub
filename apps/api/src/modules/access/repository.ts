import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '@appsolo/database';
import {
  accessAuditEvents,
  organizationInvitations,
  organizationMemberships,
  organizations,
  users,
} from '@appsolo/database/schema';
import type {
  AccessEventType,
  CreateInvitationInput,
  MembershipStatus,
  OrganizationRole,
  UpdateMembershipInput,
} from '@appsolo/shared';

type AccessContext = {
  organizationId: string;
  organizationName: string;
  organizationType: 'INTERNAL' | 'CLIENT';
  actorMembershipId: string;
  actorRole: OrganizationRole;
};
type InvitationAuthorization = (
  context: AccessContext,
  targetRole: OrganizationRole,
  currentMembershipRole?: OrganizationRole,
) => void;
type MembershipAuthorization = (
  context: AccessContext,
  target: {
    membershipId: string;
    userId: string;
    role: OrganizationRole;
    status: MembershipStatus;
  },
  input: UpdateMembershipInput,
) => void;

export type AccessState =
  | 'DUPLICATE_INVITATION'
  | 'EXISTING_MEMBERSHIP'
  | 'GLOBAL_USER_SUSPENDED'
  | 'INVITATION_NOT_FOUND'
  | 'INVITATION_STALE'
  | 'INVITATION_INVALID'
  | 'INVITATION_EXPIRED'
  | 'MEMBERSHIP_NOT_FOUND'
  | 'MEMBERSHIP_STALE'
  | 'LAST_OWNER';

export class AccessStateError extends Error {
  constructor(readonly state: AccessState) {
    super(state);
  }
}

const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isUniqueViolation(error.cause);
};

const actorContextSelect = {
  organizationId: organizations.id,
  organizationName: organizations.name,
  organizationType: organizations.type,
  actorMembershipId: organizationMemberships.id,
  actorRole: organizationMemberships.role,
};

export class AccessRepository {
  constructor(private readonly db: Database) {}

  async findAccessContext(organizationId: string, actorUserId: string): Promise<AccessContext | undefined> {
    const rows = await this.db
      .select(actorContextSelect)
      .from(organizations)
      .innerJoin(
        organizationMemberships,
        and(
          eq(organizationMemberships.organizationId, organizations.id),
          eq(organizationMemberships.userId, actorUserId),
          eq(organizationMemberships.status, 'ACTIVE'),
        ),
      )
      .innerJoin(users, and(eq(users.id, actorUserId), eq(users.status, 'ACTIVE')))
      .where(and(eq(organizations.id, organizationId), eq(organizations.status, 'ACTIVE')))
      .limit(1);
    return rows[0];
  }

  async listMembers(organizationId: string, limit: number, offset: number) {
    return this.db
      .select({
        membershipId: organizationMemberships.id,
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        userStatus: users.status,
        role: organizationMemberships.role,
        status: organizationMemberships.status,
        createdAt: organizationMemberships.createdAt,
        updatedAt: organizationMemberships.updatedAt,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, organizationId))
      .orderBy(asc(users.lastName), asc(users.firstName), asc(users.email), asc(organizationMemberships.id))
      .limit(limit)
      .offset(offset);
  }

  async listInvitations(organizationId: string, limit: number, offset: number) {
    return this.db
      .select({
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        invitedUserId: organizationInvitations.invitedUserId,
        email: organizationInvitations.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: organizationInvitations.proposedRole,
        status: organizationInvitations.status,
        invitedByUserId: organizationInvitations.invitedByUserId,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
        revokedAt: organizationInvitations.revokedAt,
        resentAt: organizationInvitations.resentAt,
        resendCount: organizationInvitations.resendCount,
        createdAt: organizationInvitations.createdAt,
        updatedAt: organizationInvitations.updatedAt,
      })
      .from(organizationInvitations)
      .innerJoin(users, eq(organizationInvitations.invitedUserId, users.id))
      .where(eq(organizationInvitations.organizationId, organizationId))
      .orderBy(desc(organizationInvitations.createdAt), desc(organizationInvitations.id))
      .limit(limit)
      .offset(offset);
  }

  async listAccessEvents(organizationId: string, limit: number, offset: number) {
    const actor = alias(users, 'access_event_actor');
    const subject = alias(users, 'access_event_subject');
    return this.db
      .select({
        id: accessAuditEvents.id,
        organizationId: accessAuditEvents.organizationId,
        eventType: accessAuditEvents.eventType,
        actorUserId: accessAuditEvents.actorUserId,
        actorFirstName: actor.firstName,
        actorLastName: actor.lastName,
        subjectUserId: accessAuditEvents.subjectUserId,
        subjectFirstName: subject.firstName,
        subjectLastName: subject.lastName,
        invitationId: accessAuditEvents.invitationId,
        membershipId: accessAuditEvents.membershipId,
        previousRole: accessAuditEvents.previousRole,
        newRole: accessAuditEvents.newRole,
        previousStatus: accessAuditEvents.previousStatus,
        newStatus: accessAuditEvents.newStatus,
        createdAt: accessAuditEvents.createdAt,
      })
      .from(accessAuditEvents)
      .leftJoin(actor, eq(accessAuditEvents.actorUserId, actor.id))
      .innerJoin(subject, eq(accessAuditEvents.subjectUserId, subject.id))
      .where(eq(accessAuditEvents.organizationId, organizationId))
      .orderBy(desc(accessAuditEvents.createdAt), desc(accessAuditEvents.id))
      .limit(limit)
      .offset(offset);
  }

  async createInvitation(input: {
    organizationId: string;
    actorUserId: string;
    invitation: CreateInvitationInput;
    tokenHash: string;
    expiresAt: Date;
    authorize: InvitationAuthorization;
  }) {
    return this.db.transaction(async (tx) => {
      const contextRows = await tx
        .select(actorContextSelect)
        .from(organizations)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.userId, input.actorUserId),
            eq(organizationMemberships.status, 'ACTIVE'),
          ),
        )
        .innerJoin(users, and(eq(users.id, input.actorUserId), eq(users.status, 'ACTIVE')))
        .where(and(eq(organizations.id, input.organizationId), eq(organizations.status, 'ACTIVE')))
        .limit(1);
      const context = contextRows[0];
      if (!context) throw new AccessStateError('INVITATION_STALE');
      input.authorize(context, input.invitation.role);

      let invitedUser = await tx.query.users.findFirst({
        where: (user, operators) => operators.eq(user.email, input.invitation.email),
      });
      if (invitedUser?.status === 'SUSPENDED') {
        throw new AccessStateError('GLOBAL_USER_SUSPENDED');
      }
      if (!invitedUser) {
        const inserted = await tx
          .insert(users)
          .values({
            email: input.invitation.email,
            firstName: input.invitation.firstName,
            lastName: input.invitation.lastName,
            status: 'INVITED',
          })
          .onConflictDoNothing({ target: users.email })
          .returning();
        invitedUser = inserted[0];
        if (!invitedUser) {
          invitedUser = await tx.query.users.findFirst({
            where: (user, operators) => operators.eq(user.email, input.invitation.email),
          });
        }
      }
      if (invitedUser?.status === 'SUSPENDED') {
        throw new AccessStateError('GLOBAL_USER_SUSPENDED');
      }
      if (!invitedUser) throw new Error('Invited user insert did not return a record.');

      const membership = await tx.query.organizationMemberships.findFirst({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.organizationId, input.organizationId),
            operators.eq(row.userId, invitedUser.id),
          ),
      });
      if (membership?.status === 'ACTIVE') throw new AccessStateError('EXISTING_MEMBERSHIP');
      if (membership) {
        input.authorize(context, input.invitation.role, membership.role);
      }

      try {
        const inserted = await tx
          .insert(organizationInvitations)
          .values({
            organizationId: input.organizationId,
            invitedUserId: invitedUser.id,
            email: invitedUser.email,
            proposedRole: input.invitation.role,
            invitedByUserId: input.actorUserId,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
          })
          .returning();
        const invitation = inserted[0];
        if (!invitation) throw new Error('Invitation insert did not return a record.');
        await tx.insert(accessAuditEvents).values({
          organizationId: input.organizationId,
          eventType: 'INVITATION_CREATED',
          actorUserId: input.actorUserId,
          subjectUserId: invitedUser.id,
          invitationId: invitation.id,
          newRole: invitation.proposedRole,
        });
        return { invitation, invitedUser };
      } catch (error: unknown) {
        if (isUniqueViolation(error)) {
          throw new AccessStateError('DUPLICATE_INVITATION');
        }
        throw error;
      }
    });
  }

  async resendInvitation(input: {
    organizationId: string;
    invitationId: string;
    actorUserId: string;
    tokenHash: string;
    expiresAt: Date;
    authorize: InvitationAuthorization;
  }) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from organization_invitations where id = ${input.invitationId} and organization_id = ${input.organizationId} for update`,
      );
      const contextRows = await tx
        .select(actorContextSelect)
        .from(organizations)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.userId, input.actorUserId),
            eq(organizationMemberships.status, 'ACTIVE'),
          ),
        )
        .innerJoin(users, and(eq(users.id, input.actorUserId), eq(users.status, 'ACTIVE')))
        .where(and(eq(organizations.id, input.organizationId), eq(organizations.status, 'ACTIVE')))
        .limit(1);
      const invitation = await tx.query.organizationInvitations.findFirst({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.id, input.invitationId),
            operators.eq(row.organizationId, input.organizationId),
          ),
      });
      const context = contextRows[0];
      if (!context || !invitation) {
        throw new AccessStateError('INVITATION_NOT_FOUND');
      }
      if (invitation.status !== 'PENDING') {
        throw new AccessStateError('INVITATION_STALE');
      }
      const membership = await tx.query.organizationMemberships.findFirst({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.organizationId, input.organizationId),
            operators.eq(row.userId, invitation.invitedUserId),
          ),
      });
      if (membership?.status === 'ACTIVE') {
        throw new AccessStateError('INVITATION_STALE');
      }
      input.authorize(context, invitation.proposedRole, membership?.role);
      const updatedRows = await tx
        .update(organizationInvitations)
        .set({
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          resendCount: invitation.resendCount + 1,
          resentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(organizationInvitations.id, invitation.id), eq(organizationInvitations.status, 'PENDING')),
        )
        .returning();
      const updated = updatedRows[0];
      if (!updated) throw new AccessStateError('INVITATION_STALE');
      await tx.insert(accessAuditEvents).values({
        organizationId: input.organizationId,
        eventType: 'INVITATION_RESENT',
        actorUserId: input.actorUserId,
        subjectUserId: invitation.invitedUserId,
        invitationId: invitation.id,
        newRole: invitation.proposedRole,
      });
      const invitedUser = await tx.query.users.findFirst({
        where: (user, operators) => operators.eq(user.id, invitation.invitedUserId),
      });
      if (!invitedUser) throw new Error('Invitation subject was not found.');
      return { invitation: updated, invitedUser };
    });
  }

  async revokeInvitation(input: {
    organizationId: string;
    invitationId: string;
    actorUserId: string;
    authorize: InvitationAuthorization;
  }) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from organization_invitations where id = ${input.invitationId} and organization_id = ${input.organizationId} for update`,
      );
      const contextRows = await tx
        .select(actorContextSelect)
        .from(organizations)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.userId, input.actorUserId),
            eq(organizationMemberships.status, 'ACTIVE'),
          ),
        )
        .innerJoin(users, and(eq(users.id, input.actorUserId), eq(users.status, 'ACTIVE')))
        .where(and(eq(organizations.id, input.organizationId), eq(organizations.status, 'ACTIVE')))
        .limit(1);
      const invitation = await tx.query.organizationInvitations.findFirst({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.id, input.invitationId),
            operators.eq(row.organizationId, input.organizationId),
          ),
      });
      const context = contextRows[0];
      if (!context || !invitation) {
        throw new AccessStateError('INVITATION_NOT_FOUND');
      }
      if (invitation.status !== 'PENDING') {
        throw new AccessStateError('INVITATION_STALE');
      }
      input.authorize(context, invitation.proposedRole);
      const updatedRows = await tx
        .update(organizationInvitations)
        .set({
          status: 'REVOKED',
          revokedAt: new Date(),
          tokenHash: randomBytes(32).toString('hex'),
          updatedAt: new Date(),
        })
        .where(
          and(eq(organizationInvitations.id, invitation.id), eq(organizationInvitations.status, 'PENDING')),
        )
        .returning();
      const updated = updatedRows[0];
      if (!updated) throw new AccessStateError('INVITATION_STALE');
      await tx.insert(accessAuditEvents).values({
        organizationId: input.organizationId,
        eventType: 'INVITATION_REVOKED',
        actorUserId: input.actorUserId,
        subjectUserId: invitation.invitedUserId,
        invitationId: invitation.id,
        newRole: invitation.proposedRole,
      });
      const invitedUser = await tx.query.users.findFirst({
        where: (user, operators) => operators.eq(user.id, invitation.invitedUserId),
      });
      if (!invitedUser) throw new Error('Invitation subject was not found.');
      return { invitation: updated, invitedUser };
    });
  }

  async acceptInvitation(
    tokenHash: string,
    now: Date,
    authorize: InvitationAuthorization,
  ): Promise<{ userId: string }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from organization_invitations where token_hash = ${tokenHash} for update`,
      );
      const invitation = await tx.query.organizationInvitations.findFirst({
        where: (row, operators) => operators.eq(row.tokenHash, tokenHash),
      });
      if (!invitation || invitation.status !== 'PENDING') {
        throw new AccessStateError('INVITATION_INVALID');
      }
      if (invitation.expiresAt.getTime() <= now.getTime()) {
        throw new AccessStateError('INVITATION_EXPIRED');
      }
      const organization = await tx.query.organizations.findFirst({
        where: (row, operators) =>
          operators.and(operators.eq(row.id, invitation.organizationId), operators.eq(row.status, 'ACTIVE')),
      });
      const user = await tx.query.users.findFirst({
        where: (row, operators) => operators.eq(row.id, invitation.invitedUserId),
      });
      if (!organization || !user || user.status === 'SUSPENDED') {
        throw new AccessStateError('INVITATION_INVALID');
      }
      if (
        organization.type === 'INTERNAL' &&
        (invitation.proposedRole === 'CLIENT_ADMIN' || invitation.proposedRole === 'CLIENT_MEMBER')
      ) {
        throw new AccessStateError('INVITATION_INVALID');
      }
      await tx.execute(
        sql`select id from organization_memberships
            where organization_id = ${invitation.organizationId}
              and user_id in (${invitation.invitedByUserId}, ${invitation.invitedUserId})
            order by id
            for update`,
      );
      const inviterContextRows = await tx
        .select(actorContextSelect)
        .from(organizations)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.userId, invitation.invitedByUserId),
            eq(organizationMemberships.status, 'ACTIVE'),
          ),
        )
        .innerJoin(users, and(eq(users.id, invitation.invitedByUserId), eq(users.status, 'ACTIVE')))
        .where(and(eq(organizations.id, invitation.organizationId), eq(organizations.status, 'ACTIVE')))
        .limit(1);
      const inviterContext = inviterContextRows[0];
      if (!inviterContext) throw new AccessStateError('INVITATION_INVALID');

      let membership = await tx.query.organizationMemberships.findFirst({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.organizationId, invitation.organizationId),
            operators.eq(row.userId, invitation.invitedUserId),
          ),
      });
      if (membership?.status === 'ACTIVE') {
        throw new AccessStateError('INVITATION_INVALID');
      }
      try {
        authorize(inviterContext, invitation.proposedRole, membership?.role);
      } catch {
        throw new AccessStateError('INVITATION_INVALID');
      }
      if (membership) {
        const reactivated = await tx
          .update(organizationMemberships)
          .set({
            role: invitation.proposedRole,
            status: 'ACTIVE',
            updatedAt: now,
          })
          .where(
            and(
              eq(organizationMemberships.id, membership.id),
              eq(organizationMemberships.status, 'SUSPENDED'),
            ),
          )
          .returning();
        membership = reactivated[0];
      } else {
        const inserted = await tx
          .insert(organizationMemberships)
          .values({
            organizationId: invitation.organizationId,
            userId: invitation.invitedUserId,
            role: invitation.proposedRole,
            status: 'ACTIVE',
          })
          .returning();
        membership = inserted[0];
      }
      if (!membership) throw new AccessStateError('INVITATION_INVALID');
      if (user.status === 'INVITED') {
        await tx
          .update(users)
          .set({ status: 'ACTIVE', updatedAt: now })
          .where(and(eq(users.id, user.id), eq(users.status, 'INVITED')));
      }
      const accepted = await tx
        .update(organizationInvitations)
        .set({ status: 'ACCEPTED', acceptedAt: now, updatedAt: now })
        .where(
          and(
            eq(organizationInvitations.id, invitation.id),
            eq(organizationInvitations.status, 'PENDING'),
            eq(organizationInvitations.tokenHash, tokenHash),
          ),
        )
        .returning({ id: organizationInvitations.id });
      if (accepted.length !== 1) throw new AccessStateError('INVITATION_INVALID');
      await tx.insert(accessAuditEvents).values({
        organizationId: invitation.organizationId,
        eventType: 'INVITATION_ACCEPTED',
        actorUserId: invitation.invitedUserId,
        subjectUserId: invitation.invitedUserId,
        invitationId: invitation.id,
        membershipId: membership.id,
        newRole: membership.role,
        newStatus: 'ACTIVE',
      });
      return { userId: invitation.invitedUserId };
    });
  }

  async updateMembership(input: {
    organizationId: string;
    membershipId: string;
    actorUserId: string;
    update: UpdateMembershipInput;
    authorize: MembershipAuthorization;
  }) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.organizationId}))`);
      const contextRows = await tx
        .select(actorContextSelect)
        .from(organizations)
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.userId, input.actorUserId),
            eq(organizationMemberships.status, 'ACTIVE'),
          ),
        )
        .innerJoin(users, and(eq(users.id, input.actorUserId), eq(users.status, 'ACTIVE')))
        .where(and(eq(organizations.id, input.organizationId), eq(organizations.status, 'ACTIVE')))
        .limit(1);
      const context = contextRows[0];
      const target = await tx.query.organizationMemberships.findFirst({
        where: (row, operators) =>
          operators.and(
            operators.eq(row.id, input.membershipId),
            operators.eq(row.organizationId, input.organizationId),
          ),
      });
      if (!context || !target) throw new AccessStateError('MEMBERSHIP_NOT_FOUND');
      input.authorize(
        context,
        {
          membershipId: target.id,
          userId: target.userId,
          role: target.role,
          status: target.status,
        },
        input.update,
      );
      if (target.updatedAt.toISOString() !== input.update.expectedUpdatedAt) {
        throw new AccessStateError('MEMBERSHIP_STALE');
      }

      const nextRole = input.update.role ?? target.role;
      const nextStatus = input.update.status ?? target.status;
      if (
        target.role === 'OWNER' &&
        target.status === 'ACTIVE' &&
        (nextRole !== 'OWNER' || nextStatus !== 'ACTIVE')
      ) {
        const owners = await tx
          .select({ id: organizationMemberships.id })
          .from(organizationMemberships)
          .innerJoin(users, eq(organizationMemberships.userId, users.id))
          .where(
            and(
              eq(organizationMemberships.organizationId, input.organizationId),
              eq(organizationMemberships.role, 'OWNER'),
              eq(organizationMemberships.status, 'ACTIVE'),
              eq(users.status, 'ACTIVE'),
            ),
          );
        if (owners.length <= 1) throw new AccessStateError('LAST_OWNER');
      }

      const updatedRows = await tx
        .update(organizationMemberships)
        .set({ role: nextRole, status: nextStatus, updatedAt: new Date() })
        .where(eq(organizationMemberships.id, target.id))
        .returning();
      const updated = updatedRows[0];
      if (!updated) throw new AccessStateError('MEMBERSHIP_STALE');
      const events: Array<{
        eventType: AccessEventType;
        previousRole?: OrganizationRole;
        newRole?: OrganizationRole;
        previousStatus?: MembershipStatus;
        newStatus?: MembershipStatus;
      }> = [];
      if (target.role !== updated.role) {
        events.push({
          eventType: 'MEMBERSHIP_ROLE_CHANGED',
          previousRole: target.role,
          newRole: updated.role,
        });
      }
      if (target.status !== updated.status) {
        events.push({
          eventType: updated.status === 'SUSPENDED' ? 'MEMBERSHIP_SUSPENDED' : 'MEMBERSHIP_REACTIVATED',
          previousStatus: target.status,
          newStatus: updated.status,
        });
      }
      if (events.length > 0) {
        await tx.insert(accessAuditEvents).values(
          events.map((event) => ({
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            subjectUserId: target.userId,
            membershipId: target.id,
            ...event,
          })),
        );
      }
      const targetUser = await tx.query.users.findFirst({
        where: (user, operators) => operators.eq(user.id, target.userId),
      });
      if (!targetUser) throw new Error('Membership user was not found.');
      return { membership: updated, user: targetUser };
    });
  }
}
