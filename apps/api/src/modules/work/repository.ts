import { and, asc, desc, eq, isNotNull, isNull, max, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '@appsolo/database';
import {
  changeRequests,
  comments,
  estimateResponses,
  estimates,
  organizationMemberships,
  organizations,
  projects,
  statusHistory,
  timeEntries,
  users,
  workReviewHandoffs,
  workReviewResponses,
} from '@appsolo/database/schema';
import type {
  CancelChangeRequestInput,
  CreateReviewHandoffInput,
  CreateTimeEntryInput,
  OrganizationRole,
  RespondToReviewHandoffInput,
  VoidTimeEntryInput,
} from '@appsolo/shared';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type CapabilityCheck = (role: OrganizationRole) => boolean;

export type WorkRequestContext = {
  changeRequestId: string;
  requestStatus: typeof changeRequests.$inferSelect.status;
  requestUpdatedAt: Date;
  organizationId: string;
  role: OrganizationRole;
};

export type WorkMutationResult =
  | {
      outcome: 'SUCCESS';
      changeRequestId: string;
      status: typeof changeRequests.$inferSelect.status;
      updatedAt: Date;
      handoffId: string | null;
    }
  | { outcome: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' };

export type TimeMutationResult =
  | { outcome: 'SUCCESS'; changeRequestId: string; timeEntryId: string }
  | { outcome: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' };

const voidUser = alias(users, 'void_user');
const responseUser = alias(users, 'work_response_user');

export class WorkRepository {
  constructor(private readonly db: Database) {}

  private requestContextQuery(database: Database | Transaction, changeRequestId: string, userId: string) {
    return database
      .select({
        changeRequestId: changeRequests.id,
        requestStatus: changeRequests.status,
        requestUpdatedAt: changeRequests.updatedAt,
        organizationId: organizations.id,
        role: organizationMemberships.role,
      })
      .from(changeRequests)
      .innerJoin(projects, eq(changeRequests.projectId, projects.id))
      .innerJoin(organizations, eq(projects.organizationId, organizations.id))
      .innerJoin(
        organizationMemberships,
        and(
          eq(organizationMemberships.organizationId, organizations.id),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, 'ACTIVE'),
        ),
      )
      .where(
        and(
          eq(changeRequests.id, changeRequestId),
          eq(projects.status, 'ACTIVE'),
          eq(organizations.status, 'ACTIVE'),
          eq(organizations.type, 'CLIENT'),
        ),
      )
      .limit(1);
  }

  async findRequestContext(changeRequestId: string, userId: string): Promise<WorkRequestContext | undefined> {
    const rows = await this.requestContextQuery(this.db, changeRequestId, userId);
    return rows[0];
  }

  async listTimeEntries(changeRequestId: string, limit: number, offset: number) {
    return this.db
      .select({
        id: timeEntries.id,
        changeRequestId: timeEntries.changeRequestId,
        durationMinutes: timeEntries.durationMinutes,
        description: timeEntries.description,
        workDate: timeEntries.workDate,
        authorUserId: timeEntries.userId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        createdAt: timeEntries.createdAt,
        updatedAt: timeEntries.updatedAt,
        voidedAt: timeEntries.voidedAt,
        voidReason: timeEntries.voidReason,
        voidedByUserId: timeEntries.voidedByUserId,
        voidedByFirstName: voidUser.firstName,
        voidedByLastName: voidUser.lastName,
      })
      .from(timeEntries)
      .innerJoin(users, eq(timeEntries.userId, users.id))
      .leftJoin(voidUser, eq(timeEntries.voidedByUserId, voidUser.id))
      .where(eq(timeEntries.changeRequestId, changeRequestId))
      .orderBy(desc(timeEntries.workDate), desc(timeEntries.createdAt), desc(timeEntries.id))
      .limit(limit)
      .offset(offset);
  }

  async activeTimeTotal(changeRequestId: string): Promise<number> {
    const [row] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)::integer`,
      })
      .from(timeEntries)
      .where(and(eq(timeEntries.changeRequestId, changeRequestId), isNull(timeEntries.voidedAt)));
    return row?.total ?? 0;
  }

  async findTimeEntry(changeRequestId: string, timeEntryId: string) {
    const rows = await this.db
      .select({
        id: timeEntries.id,
        changeRequestId: timeEntries.changeRequestId,
        durationMinutes: timeEntries.durationMinutes,
        description: timeEntries.description,
        workDate: timeEntries.workDate,
        authorUserId: timeEntries.userId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        createdAt: timeEntries.createdAt,
        updatedAt: timeEntries.updatedAt,
        voidedAt: timeEntries.voidedAt,
        voidReason: timeEntries.voidReason,
        voidedByUserId: timeEntries.voidedByUserId,
        voidedByFirstName: voidUser.firstName,
        voidedByLastName: voidUser.lastName,
      })
      .from(timeEntries)
      .innerJoin(users, eq(timeEntries.userId, users.id))
      .leftJoin(voidUser, eq(timeEntries.voidedByUserId, voidUser.id))
      .where(and(eq(timeEntries.changeRequestId, changeRequestId), eq(timeEntries.id, timeEntryId)))
      .limit(1);
    return rows[0];
  }

  async createTimeEntry(
    changeRequestId: string,
    userId: string,
    input: CreateTimeEntryInput,
    canCreate: CapabilityCheck,
  ): Promise<TimeMutationResult> {
    return this.db.transaction(async (tx) => {
      const [context] = await this.requestContextQuery(tx, changeRequestId, userId).for('update', {
        of: [changeRequests, organizationMemberships],
      });
      if (!context) return { outcome: 'NOT_FOUND' };
      if (!canCreate(context.role)) return { outcome: 'FORBIDDEN' };
      if (context.requestStatus !== 'IN_PROGRESS') return { outcome: 'CONFLICT' };
      const [created] = await tx
        .insert(timeEntries)
        .values({
          changeRequestId,
          userId,
          durationMinutes: input.durationMinutes,
          description: input.description,
          workDate: input.workDate,
        })
        .returning({ id: timeEntries.id });
      if (!created) throw new Error('Time entry insert did not return a record.');
      return {
        outcome: 'SUCCESS',
        changeRequestId,
        timeEntryId: created.id,
      };
    });
  }

  async voidTimeEntry(
    timeEntryId: string,
    userId: string,
    input: VoidTimeEntryInput,
    canVoidOwn: CapabilityCheck,
    canManage: CapabilityCheck,
  ): Promise<TimeMutationResult> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          timeEntryId: timeEntries.id,
          changeRequestId: timeEntries.changeRequestId,
          entryUserId: timeEntries.userId,
          entryUpdatedAt: timeEntries.updatedAt,
          voidedAt: timeEntries.voidedAt,
          role: organizationMemberships.role,
        })
        .from(timeEntries)
        .innerJoin(changeRequests, eq(timeEntries.changeRequestId, changeRequests.id))
        .innerJoin(projects, eq(changeRequests.projectId, projects.id))
        .innerJoin(organizations, eq(projects.organizationId, organizations.id))
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.status, 'ACTIVE'),
          ),
        )
        .where(
          and(
            eq(timeEntries.id, timeEntryId),
            eq(projects.status, 'ACTIVE'),
            eq(organizations.status, 'ACTIVE'),
            eq(organizations.type, 'CLIENT'),
          ),
        )
        .limit(1)
        .for('update', { of: [timeEntries, organizationMemberships] });
      const row = rows[0];
      if (!row) return { outcome: 'NOT_FOUND' };
      const allowed = canManage(row.role) || (row.entryUserId === userId && canVoidOwn(row.role));
      if (!allowed) return { outcome: 'FORBIDDEN' };
      if (row.voidedAt !== null || row.entryUpdatedAt.toISOString() !== input.expectedUpdatedAt)
        return { outcome: 'CONFLICT' };
      const now = new Date();
      const [updated] = await tx
        .update(timeEntries)
        .set({
          voidedByUserId: userId,
          voidReason: input.reason,
          voidedAt: now,
          updatedAt: now,
        })
        .where(and(eq(timeEntries.id, timeEntryId), isNull(timeEntries.voidedAt)))
        .returning({ id: timeEntries.id });
      if (!updated) return { outcome: 'CONFLICT' };
      return {
        outcome: 'SUCCESS',
        changeRequestId: row.changeRequestId,
        timeEntryId: updated.id,
      };
    });
  }

  async startWork(
    changeRequestId: string,
    userId: string,
    expectedUpdatedAt: string,
    canManageWork: CapabilityCheck,
  ): Promise<WorkMutationResult> {
    return this.transitionRequest(
      changeRequestId,
      userId,
      expectedUpdatedAt,
      'APPROVED',
      'IN_PROGRESS',
      canManageWork,
      null,
    );
  }

  private async transitionRequest(
    changeRequestId: string,
    userId: string,
    expectedUpdatedAt: string,
    expectedStatus: typeof changeRequests.$inferSelect.status,
    nextStatus: typeof changeRequests.$inferSelect.status,
    capability: CapabilityCheck,
    note: string | null,
  ): Promise<WorkMutationResult> {
    return this.db.transaction(async (tx) => {
      const [context] = await this.requestContextQuery(tx, changeRequestId, userId).for('update', {
        of: [changeRequests, organizationMemberships],
      });
      if (!context) return { outcome: 'NOT_FOUND' };
      if (!capability(context.role)) return { outcome: 'FORBIDDEN' };
      if (
        context.requestStatus !== expectedStatus ||
        context.requestUpdatedAt.toISOString() !== expectedUpdatedAt
      )
        return { outcome: 'CONFLICT' };
      const now = new Date();
      const [updated] = await tx
        .update(changeRequests)
        .set({ status: nextStatus, updatedAt: now })
        .where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.status, expectedStatus)))
        .returning({ updatedAt: changeRequests.updatedAt });
      if (!updated) return { outcome: 'CONFLICT' };
      await tx.insert(statusHistory).values({
        changeRequestId,
        changedByUserId: userId,
        previousStatus: expectedStatus,
        newStatus: nextStatus,
        note,
        createdAt: now,
      });
      return {
        outcome: 'SUCCESS',
        changeRequestId,
        status: nextStatus,
        updatedAt: updated.updatedAt,
        handoffId: null,
      };
    });
  }

  async createHandoff(
    changeRequestId: string,
    userId: string,
    input: CreateReviewHandoffInput,
    canManageWork: CapabilityCheck,
  ): Promise<WorkMutationResult> {
    return this.db.transaction(async (tx) => {
      const [context] = await this.requestContextQuery(tx, changeRequestId, userId).for('update', {
        of: [changeRequests, organizationMemberships],
      });
      if (!context) return { outcome: 'NOT_FOUND' };
      if (!canManageWork(context.role)) return { outcome: 'FORBIDDEN' };
      if (
        context.requestStatus !== 'IN_PROGRESS' ||
        context.requestUpdatedAt.toISOString() !== input.expectedUpdatedAt
      )
        return { outcome: 'CONFLICT' };
      const [versionRow] = await tx
        .select({ version: max(workReviewHandoffs.version) })
        .from(workReviewHandoffs)
        .where(eq(workReviewHandoffs.changeRequestId, changeRequestId));
      const version = (versionRow?.version ?? 0) + 1;
      const now = new Date();
      const [handoff] = await tx
        .insert(workReviewHandoffs)
        .values({
          changeRequestId,
          version,
          createdByUserId: userId,
          workSummary: input.workSummary,
          releaseNotes: input.releaseNotes ?? null,
          createdAt: now,
        })
        .returning({ id: workReviewHandoffs.id });
      if (!handoff) throw new Error('Work handoff insert did not return a record.');
      const [updated] = await tx
        .update(changeRequests)
        .set({ status: 'READY_FOR_REVIEW', updatedAt: now })
        .where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.status, 'IN_PROGRESS')))
        .returning({ updatedAt: changeRequests.updatedAt });
      if (!updated) return { outcome: 'CONFLICT' };
      await tx.insert(statusHistory).values({
        changeRequestId,
        changedByUserId: userId,
        previousStatus: 'IN_PROGRESS',
        newStatus: 'READY_FOR_REVIEW',
        createdAt: now,
      });
      return {
        outcome: 'SUCCESS',
        changeRequestId,
        status: 'READY_FOR_REVIEW',
        updatedAt: updated.updatedAt,
        handoffId: handoff.id,
      };
    });
  }

  async respondToHandoff(
    handoffId: string,
    userId: string,
    input: RespondToReviewHandoffInput,
    canRespond: CapabilityCheck,
  ): Promise<WorkMutationResult> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          handoffId: workReviewHandoffs.id,
          changeRequestId: workReviewHandoffs.changeRequestId,
          handoffVersion: workReviewHandoffs.version,
          requestStatus: changeRequests.status,
          requestUpdatedAt: changeRequests.updatedAt,
          role: organizationMemberships.role,
          existingResponseId: workReviewResponses.id,
        })
        .from(workReviewHandoffs)
        .innerJoin(changeRequests, eq(workReviewHandoffs.changeRequestId, changeRequests.id))
        .innerJoin(projects, eq(changeRequests.projectId, projects.id))
        .innerJoin(organizations, eq(projects.organizationId, organizations.id))
        .innerJoin(
          organizationMemberships,
          and(
            eq(organizationMemberships.organizationId, organizations.id),
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.status, 'ACTIVE'),
          ),
        )
        .leftJoin(workReviewResponses, eq(workReviewResponses.handoffId, workReviewHandoffs.id))
        .where(
          and(
            eq(workReviewHandoffs.id, handoffId),
            eq(projects.status, 'ACTIVE'),
            eq(organizations.status, 'ACTIVE'),
            eq(organizations.type, 'CLIENT'),
          ),
        )
        .limit(1)
        .for('update', { of: [changeRequests, workReviewHandoffs] });
      const row = rows[0];
      if (!row) return { outcome: 'NOT_FOUND' };
      if (!canRespond(row.role)) return { outcome: 'FORBIDDEN' };
      if (
        row.requestStatus !== 'READY_FOR_REVIEW' ||
        row.requestUpdatedAt.toISOString() !== input.expectedUpdatedAt ||
        row.existingResponseId !== null
      )
        return { outcome: 'CONFLICT' };
      const [latest] = await tx
        .select({ version: max(workReviewHandoffs.version) })
        .from(workReviewHandoffs)
        .where(eq(workReviewHandoffs.changeRequestId, row.changeRequestId));
      if (latest?.version !== row.handoffVersion) return { outcome: 'CONFLICT' };
      const now = new Date();
      const decision = input.decision === 'ACCEPT' ? 'ACCEPTED' : 'CHANGES_REQUESTED';
      const nextStatus = input.decision === 'ACCEPT' ? 'COMPLETED' : 'IN_PROGRESS';
      const [updated] = await tx
        .update(changeRequests)
        .set({ status: nextStatus, updatedAt: now })
        .where(and(eq(changeRequests.id, row.changeRequestId), eq(changeRequests.status, 'READY_FOR_REVIEW')))
        .returning({ updatedAt: changeRequests.updatedAt });
      if (!updated) return { outcome: 'CONFLICT' };
      await tx.insert(workReviewResponses).values({
        handoffId,
        decision,
        respondingUserId: userId,
        note: input.note ?? null,
        createdAt: now,
      });
      await tx.insert(statusHistory).values({
        changeRequestId: row.changeRequestId,
        changedByUserId: userId,
        previousStatus: 'READY_FOR_REVIEW',
        newStatus: nextStatus,
        createdAt: now,
      });
      return {
        outcome: 'SUCCESS',
        changeRequestId: row.changeRequestId,
        status: nextStatus,
        updatedAt: updated.updatedAt,
        handoffId,
      };
    });
  }

  async cancel(
    changeRequestId: string,
    userId: string,
    input: CancelChangeRequestInput,
    canCancel: CapabilityCheck,
  ): Promise<WorkMutationResult> {
    const eligible = new Set<typeof changeRequests.$inferSelect.status>([
      'SUBMITTED',
      'AWAITING_ESTIMATE',
      'AWAITING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'NEEDS_CLARIFICATION',
      'IN_PROGRESS',
      'READY_FOR_REVIEW',
    ]);
    return this.db.transaction(async (tx) => {
      const [context] = await this.requestContextQuery(tx, changeRequestId, userId).for('update', {
        of: [changeRequests, organizationMemberships],
      });
      if (!context) return { outcome: 'NOT_FOUND' };
      if (!canCancel(context.role)) return { outcome: 'FORBIDDEN' };
      if (
        !eligible.has(context.requestStatus) ||
        context.requestUpdatedAt.toISOString() !== input.expectedUpdatedAt
      )
        return { outcome: 'CONFLICT' };
      const now = new Date();
      const [updated] = await tx
        .update(changeRequests)
        .set({ status: 'CANCELLED', updatedAt: now })
        .where(and(eq(changeRequests.id, changeRequestId), eq(changeRequests.status, context.requestStatus)))
        .returning({ updatedAt: changeRequests.updatedAt });
      if (!updated) return { outcome: 'CONFLICT' };
      await tx.insert(statusHistory).values({
        changeRequestId,
        changedByUserId: userId,
        previousStatus: context.requestStatus,
        newStatus: 'CANCELLED',
        note: input.reason,
        createdAt: now,
      });
      return {
        outcome: 'SUCCESS',
        changeRequestId,
        status: 'CANCELLED',
        updatedAt: updated.updatedAt,
        handoffId: null,
      };
    });
  }

  async listHandoffs(changeRequestId: string) {
    return this.db
      .select({
        id: workReviewHandoffs.id,
        changeRequestId: workReviewHandoffs.changeRequestId,
        version: workReviewHandoffs.version,
        workSummary: workReviewHandoffs.workSummary,
        releaseNotes: workReviewHandoffs.releaseNotes,
        createdAt: workReviewHandoffs.createdAt,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        responseId: workReviewResponses.id,
        responseDecision: workReviewResponses.decision,
        responseNote: workReviewResponses.note,
        responseCreatedAt: workReviewResponses.createdAt,
        responseFirstName: responseUser.firstName,
        responseLastName: responseUser.lastName,
      })
      .from(workReviewHandoffs)
      .innerJoin(users, eq(workReviewHandoffs.createdByUserId, users.id))
      .leftJoin(workReviewResponses, eq(workReviewResponses.handoffId, workReviewHandoffs.id))
      .leftJoin(responseUser, eq(workReviewResponses.respondingUserId, responseUser.id))
      .where(eq(workReviewHandoffs.changeRequestId, changeRequestId))
      .orderBy(asc(workReviewHandoffs.version), asc(workReviewHandoffs.id));
  }

  async historySources(changeRequestId: string, includeInternal: boolean) {
    const statuses = await this.db
      .select({
        id: statusHistory.id,
        previousStatus: statusHistory.previousStatus,
        newStatus: statusHistory.newStatus,
        note: statusHistory.note,
        createdAt: statusHistory.createdAt,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
      })
      .from(statusHistory)
      .innerJoin(users, eq(statusHistory.changedByUserId, users.id))
      .where(eq(statusHistory.changeRequestId, changeRequestId));
    const estimateEvents = await this.db
      .select({
        id: estimates.id,
        version: estimates.version,
        estimatedHours: estimates.estimatedHours,
        hourlyRate: estimates.hourlyRate,
        estimatedCost: estimates.estimatedCost,
        scopeNotes: estimates.scopeNotes,
        submittedAt: estimates.submittedAt,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
      })
      .from(estimates)
      .innerJoin(users, eq(estimates.createdByUserId, users.id))
      .where(
        and(
          eq(estimates.changeRequestId, changeRequestId),
          isNotNull(estimates.submittedAt),
          ne(estimates.status, 'DRAFT'),
        ),
      );
    const estimateResponseEvents = await this.db
      .select({
        id: estimateResponses.id,
        version: estimates.version,
        decision: estimateResponses.decision,
        note: estimateResponses.note,
        createdAt: estimateResponses.createdAt,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
      })
      .from(estimateResponses)
      .innerJoin(estimates, eq(estimateResponses.estimateId, estimates.id))
      .innerJoin(users, eq(estimateResponses.respondingUserId, users.id))
      .where(eq(estimates.changeRequestId, changeRequestId));
    const commentEvents = await this.db
      .select({
        id: comments.id,
        body: comments.body,
        visibility: comments.visibility,
        createdAt: comments.createdAt,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorUserId, users.id))
      .where(
        includeInternal
          ? eq(comments.changeRequestId, changeRequestId)
          : and(eq(comments.changeRequestId, changeRequestId), eq(comments.visibility, 'CLIENT_VISIBLE')),
      );
    const handoffs = await this.listHandoffs(changeRequestId);
    const timeEvents = includeInternal
      ? await this.db
          .select({
            id: timeEntries.id,
            durationMinutes: timeEntries.durationMinutes,
            description: timeEntries.description,
            workDate: timeEntries.workDate,
            createdAt: timeEntries.createdAt,
            voidedAt: timeEntries.voidedAt,
            voidReason: timeEntries.voidReason,
            authorFirstName: users.firstName,
            authorLastName: users.lastName,
            voidedByFirstName: voidUser.firstName,
            voidedByLastName: voidUser.lastName,
          })
          .from(timeEntries)
          .innerJoin(users, eq(timeEntries.userId, users.id))
          .leftJoin(voidUser, eq(timeEntries.voidedByUserId, voidUser.id))
          .where(eq(timeEntries.changeRequestId, changeRequestId))
      : [];
    return {
      statuses,
      estimateEvents,
      estimateResponseEvents,
      commentEvents,
      handoffs,
      timeEvents,
    };
  }
}
