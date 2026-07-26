import { and, desc, eq, lt, max, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '@appsolo/database';
import {
  changeRequests,
  estimateResponses,
  estimates,
  organizationMemberships,
  organizations,
  projects,
  statusHistory,
  users,
} from '@appsolo/database/schema';
import type {
  CreateEstimateInput,
  EstimateResponseDecision,
  EstimateStatus,
  OrganizationRole,
  RespondToEstimateInput,
  UpdateEstimateInput,
} from '@appsolo/shared';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type CapabilityCheck = (role: OrganizationRole) => boolean;

export type EstimateRequestContext = {
  changeRequestId: string;
  requestStatus: typeof changeRequests.$inferSelect.status;
  organizationId: string;
  role: OrganizationRole;
};

export type MutationResult =
  { outcome: 'SUCCESS'; estimateId: string } | { outcome: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' };

const responseUser = alias(users, 'response_user');

export class EstimateRepository {
  constructor(private readonly db: Database) {}

  private requestContextQuery(database: Database | Transaction, changeRequestId: string, userId: string) {
    return database
      .select({
        changeRequestId: changeRequests.id,
        requestStatus: changeRequests.status,
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

  async findRequestContext(
    changeRequestId: string,
    userId: string,
  ): Promise<EstimateRequestContext | undefined> {
    const rows = await this.requestContextQuery(this.db, changeRequestId, userId);
    return rows[0];
  }

  async findRequestContextForEstimate(
    estimateId: string,
    userId: string,
  ): Promise<EstimateRequestContext | undefined> {
    const rows = await this.db
      .select({
        changeRequestId: changeRequests.id,
        requestStatus: changeRequests.status,
        organizationId: organizations.id,
        role: organizationMemberships.role,
      })
      .from(estimates)
      .innerJoin(changeRequests, eq(estimates.changeRequestId, changeRequests.id))
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
          eq(estimates.id, estimateId),
          eq(projects.status, 'ACTIVE'),
          eq(organizations.status, 'ACTIVE'),
          eq(organizations.type, 'CLIENT'),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async list(changeRequestId: string, includeDraft: boolean) {
    return this.db
      .select({
        id: estimates.id,
        changeRequestId: estimates.changeRequestId,
        version: estimates.version,
        estimatedHours: estimates.estimatedHours,
        hourlyRate: estimates.hourlyRate,
        estimatedCost: estimates.estimatedCost,
        scopeNotes: estimates.scopeNotes,
        status: estimates.status,
        submittedAt: estimates.submittedAt,
        createdAt: estimates.createdAt,
        updatedAt: estimates.updatedAt,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        responseDecision: estimateResponses.decision,
        responseNote: estimateResponses.note,
        responseCreatedAt: estimateResponses.createdAt,
        responseFirstName: responseUser.firstName,
        responseLastName: responseUser.lastName,
      })
      .from(estimates)
      .innerJoin(users, eq(estimates.createdByUserId, users.id))
      .leftJoin(estimateResponses, eq(estimateResponses.estimateId, estimates.id))
      .leftJoin(responseUser, eq(estimateResponses.respondingUserId, responseUser.id))
      .where(
        includeDraft
          ? eq(estimates.changeRequestId, changeRequestId)
          : and(eq(estimates.changeRequestId, changeRequestId), sql`${estimates.status} <> 'DRAFT'`),
      )
      .orderBy(desc(estimates.version), desc(estimates.id));
  }

  async createDraft(
    changeRequestId: string,
    userId: string,
    input: CreateEstimateInput,
    estimatedCost: string,
    canManage: CapabilityCheck,
  ): Promise<MutationResult> {
    return this.db.transaction(async (tx) => {
      const contexts = await this.requestContextQuery(tx, changeRequestId, userId).for('update', {
        of: changeRequests,
      });
      const context = contexts[0];
      if (!context) return { outcome: 'NOT_FOUND' };
      if (!canManage(context.role)) return { outcome: 'FORBIDDEN' };
      if (
        !['SUBMITTED', 'AWAITING_ESTIMATE', 'REJECTED', 'NEEDS_CLARIFICATION'].includes(context.requestStatus)
      )
        return { outcome: 'CONFLICT' };

      const [versionRow] = await tx
        .select({ version: max(estimates.version) })
        .from(estimates)
        .where(eq(estimates.changeRequestId, changeRequestId));
      const version = (versionRow?.version ?? 0) + 1;
      const [created] = await tx
        .insert(estimates)
        .values({
          changeRequestId,
          createdByUserId: userId,
          estimatedHours: input.estimatedHours,
          hourlyRate: input.hourlyRate,
          estimatedCost,
          scopeNotes: input.scopeNotes,
          status: 'DRAFT',
          version,
        })
        .returning({ id: estimates.id });
      if (!created) throw new Error('Estimate insert did not return a record.');

      if (context.requestStatus === 'SUBMITTED') {
        await tx
          .update(changeRequests)
          .set({ status: 'AWAITING_ESTIMATE', updatedAt: new Date() })
          .where(eq(changeRequests.id, changeRequestId));
        await tx.insert(statusHistory).values({
          changeRequestId,
          changedByUserId: userId,
          previousStatus: 'SUBMITTED',
          newStatus: 'AWAITING_ESTIMATE',
        });
      }
      return { outcome: 'SUCCESS', estimateId: created.id };
    });
  }

  async updateDraft(
    estimateId: string,
    userId: string,
    input: UpdateEstimateInput,
    estimatedCost: string,
    canManage: CapabilityCheck,
  ): Promise<MutationResult> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: estimates.id,
          status: estimates.status,
          updatedAt: estimates.updatedAt,
          role: organizationMemberships.role,
        })
        .from(estimates)
        .innerJoin(changeRequests, eq(estimates.changeRequestId, changeRequests.id))
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
            eq(estimates.id, estimateId),
            eq(projects.status, 'ACTIVE'),
            eq(organizations.status, 'ACTIVE'),
            eq(organizations.type, 'CLIENT'),
          ),
        )
        .limit(1)
        .for('update', { of: estimates });
      const row = rows[0];
      if (!row || !canManage(row.role)) return { outcome: 'NOT_FOUND' };
      if (row.status !== 'DRAFT' || row.updatedAt.toISOString() !== input.expectedUpdatedAt)
        return { outcome: 'CONFLICT' };
      const [updated] = await tx
        .update(estimates)
        .set({
          estimatedHours: input.estimatedHours,
          hourlyRate: input.hourlyRate,
          estimatedCost,
          scopeNotes: input.scopeNotes,
          updatedAt: new Date(),
        })
        .where(and(eq(estimates.id, estimateId), eq(estimates.status, 'DRAFT')))
        .returning({ id: estimates.id });
      return updated ? { outcome: 'SUCCESS', estimateId: updated.id } : { outcome: 'CONFLICT' };
    });
  }

  async submitDraft(
    estimateId: string,
    userId: string,
    expectedUpdatedAt: string,
    canManage: CapabilityCheck,
  ): Promise<MutationResult> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: estimates.id,
          changeRequestId: estimates.changeRequestId,
          version: estimates.version,
          estimateStatus: estimates.status,
          estimateUpdatedAt: estimates.updatedAt,
          requestStatus: changeRequests.status,
          role: organizationMemberships.role,
        })
        .from(estimates)
        .innerJoin(changeRequests, eq(estimates.changeRequestId, changeRequests.id))
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
            eq(estimates.id, estimateId),
            eq(projects.status, 'ACTIVE'),
            eq(organizations.status, 'ACTIVE'),
            eq(organizations.type, 'CLIENT'),
          ),
        )
        .limit(1)
        .for('update', { of: [changeRequests, estimates] });
      const row = rows[0];
      if (!row || !canManage(row.role)) return { outcome: 'NOT_FOUND' };
      if (
        row.estimateStatus !== 'DRAFT' ||
        row.estimateUpdatedAt.toISOString() !== expectedUpdatedAt ||
        !['AWAITING_ESTIMATE', 'REJECTED', 'NEEDS_CLARIFICATION'].includes(row.requestStatus)
      )
        return { outcome: 'CONFLICT' };

      const [previous] = await tx
        .select({ id: estimates.id, status: estimates.status, version: estimates.version })
        .from(estimates)
        .where(and(eq(estimates.changeRequestId, row.changeRequestId), lt(estimates.version, row.version)))
        .orderBy(desc(estimates.version), desc(estimates.id))
        .limit(1)
        .for('update');
      if (row.version > 1) {
        if (
          !previous ||
          previous.version !== row.version - 1 ||
          !['REJECTED', 'NEEDS_CLARIFICATION'].includes(previous.status)
        )
          return { outcome: 'CONFLICT' };
        await tx
          .update(estimates)
          .set({ status: 'SUPERSEDED', updatedAt: new Date() })
          .where(eq(estimates.id, previous.id));
      }

      const now = new Date();
      const [submitted] = await tx
        .update(estimates)
        .set({ status: 'SUBMITTED', submittedAt: now, updatedAt: now })
        .where(and(eq(estimates.id, estimateId), eq(estimates.status, 'DRAFT')))
        .returning({ id: estimates.id });
      if (!submitted) return { outcome: 'CONFLICT' };
      await tx
        .update(changeRequests)
        .set({ status: 'AWAITING_APPROVAL', updatedAt: now })
        .where(eq(changeRequests.id, row.changeRequestId));
      await tx.insert(statusHistory).values({
        changeRequestId: row.changeRequestId,
        changedByUserId: userId,
        previousStatus: row.requestStatus,
        newStatus: 'AWAITING_APPROVAL',
      });
      return { outcome: 'SUCCESS', estimateId: submitted.id };
    });
  }

  async respond(
    estimateId: string,
    userId: string,
    input: RespondToEstimateInput,
    canRespond: CapabilityCheck,
  ): Promise<MutationResult> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: estimates.id,
          changeRequestId: estimates.changeRequestId,
          estimateStatus: estimates.status,
          estimateUpdatedAt: estimates.updatedAt,
          requestStatus: changeRequests.status,
          role: organizationMemberships.role,
        })
        .from(estimates)
        .innerJoin(changeRequests, eq(estimates.changeRequestId, changeRequests.id))
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
            eq(estimates.id, estimateId),
            eq(projects.status, 'ACTIVE'),
            eq(organizations.status, 'ACTIVE'),
            eq(organizations.type, 'CLIENT'),
          ),
        )
        .limit(1)
        .for('update', { of: [changeRequests, estimates] });
      const row = rows[0];
      if (!row || !canRespond(row.role)) return { outcome: 'NOT_FOUND' };
      if (
        row.estimateStatus !== 'SUBMITTED' ||
        row.requestStatus !== 'AWAITING_APPROVAL' ||
        row.estimateUpdatedAt.toISOString() !== input.expectedUpdatedAt
      )
        return { outcome: 'CONFLICT' };

      const transition: Record<
        RespondToEstimateInput['decision'],
        {
          estimateStatus: EstimateStatus;
          requestStatus: typeof changeRequests.$inferSelect.status;
          responseDecision: EstimateResponseDecision;
        }
      > = {
        APPROVE: {
          estimateStatus: 'APPROVED',
          requestStatus: 'APPROVED',
          responseDecision: 'APPROVED',
        },
        REJECT: {
          estimateStatus: 'REJECTED',
          requestStatus: 'REJECTED',
          responseDecision: 'REJECTED',
        },
        REQUEST_CLARIFICATION: {
          estimateStatus: 'NEEDS_CLARIFICATION',
          requestStatus: 'NEEDS_CLARIFICATION',
          responseDecision: 'CLARIFICATION_REQUESTED',
        },
      };
      const next = transition[input.decision];
      const now = new Date();
      const [updated] = await tx
        .update(estimates)
        .set({ status: next.estimateStatus, updatedAt: now })
        .where(and(eq(estimates.id, estimateId), eq(estimates.status, 'SUBMITTED')))
        .returning({ id: estimates.id });
      if (!updated) return { outcome: 'CONFLICT' };
      await tx.insert(estimateResponses).values({
        estimateId,
        decision: next.responseDecision,
        respondingUserId: userId,
        note: input.note?.trim() || null,
        createdAt: now,
      });
      await tx
        .update(changeRequests)
        .set({ status: next.requestStatus, updatedAt: now })
        .where(eq(changeRequests.id, row.changeRequestId));
      await tx.insert(statusHistory).values({
        changeRequestId: row.changeRequestId,
        changedByUserId: userId,
        previousStatus: 'AWAITING_APPROVAL',
        newStatus: next.requestStatus,
      });
      return { outcome: 'SUCCESS', estimateId: updated.id };
    });
  }
}
