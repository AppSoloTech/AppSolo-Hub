import type {
  CancelChangeRequestInput,
  CreateReviewHandoffInput,
  CreateTimeEntryInput,
  OrganizationRole,
  RequestHistoryItem,
  RespondToReviewHandoffInput,
  ReviewHandoffDto,
  TimeEntryDto,
  VoidTimeEntryInput,
  WorkCommandDto,
} from '@appsolo/shared';
import { AppError } from '../../errors.js';
import { hasCapability } from '../access/policy.js';
import { WorkRepository, type TimeMutationResult, type WorkMutationResult } from './repository.js';

const notFound = () => new AppError('NOT_FOUND', 404, 'The requested resource was not found.');
const forbidden = () => new AppError('FORBIDDEN', 403, 'You do not have permission to perform this action.');
const conflict = () =>
  new AppError('CONFLICT', 409, 'The request changed or is no longer actionable. Refresh and try again.');
const displayName = (firstName: string, lastName: string): string => `${firstName} ${lastName}`.trim();
const normalizedDecimal = (value: string): string => {
  const [integer = '0', fraction = ''] = value.split('.');
  return `${integer}.${fraction.padEnd(2, '0')}`;
};

const canViewTime = (role: OrganizationRole): boolean => hasCapability(role, 'VIEW_PRIVATE_TIME');
const canCreateTime = (role: OrganizationRole): boolean => hasCapability(role, 'CREATE_PRIVATE_TIME');
const canVoidOwn = (role: OrganizationRole): boolean => hasCapability(role, 'VOID_OWN_PRIVATE_TIME');
const canManageTime = (role: OrganizationRole): boolean => hasCapability(role, 'MANAGE_PRIVATE_TIME');
const canManageWork = (role: OrganizationRole): boolean => hasCapability(role, 'MANAGE_REQUEST_WORK');
const canRespond = (role: OrganizationRole): boolean => hasCapability(role, 'RESPOND_TO_WORK_REVIEW');
const canCancel = (role: OrganizationRole): boolean => hasCapability(role, 'CANCEL_REQUESTS');

type TimeRow = Awaited<ReturnType<WorkRepository['listTimeEntries']>>[number];
const timeDto = (row: TimeRow): TimeEntryDto => ({
  id: row.id,
  changeRequestId: row.changeRequestId,
  durationMinutes: row.durationMinutes,
  description: row.description,
  workDate: row.workDate,
  authorUserId: row.authorUserId,
  authorDisplayName: displayName(row.authorFirstName, row.authorLastName),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  voidedAt: row.voidedAt?.toISOString() ?? null,
  voidReason: row.voidReason,
  voidedByUserId: row.voidedByUserId,
  voidedByDisplayName:
    row.voidedByFirstName !== null && row.voidedByLastName !== null
      ? displayName(row.voidedByFirstName, row.voidedByLastName)
      : null,
});

type HandoffRow = Awaited<ReturnType<WorkRepository['listHandoffs']>>[number];
const handoffDto = (row: HandoffRow): ReviewHandoffDto => ({
  id: row.id,
  changeRequestId: row.changeRequestId,
  version: row.version,
  workSummary: row.workSummary,
  releaseNotes: row.releaseNotes,
  actorDisplayName: displayName(row.creatorFirstName, row.creatorLastName),
  createdAt: row.createdAt.toISOString(),
  response:
    row.responseId !== null &&
    row.responseDecision !== null &&
    row.responseCreatedAt !== null &&
    row.responseFirstName !== null &&
    row.responseLastName !== null
      ? {
          id: row.responseId,
          decision: row.responseDecision,
          note: row.responseNote,
          actorDisplayName: displayName(row.responseFirstName, row.responseLastName),
          createdAt: row.responseCreatedAt.toISOString(),
        }
      : null,
});

const databaseCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'cause' in error ? databaseCode(error.cause) : undefined;
};

export class WorkService {
  constructor(private readonly repository: WorkRepository) {}

  private async requestContext(changeRequestId: string, userId: string) {
    const context = await this.repository.findRequestContext(changeRequestId, userId);
    if (!context) throw notFound();
    return context;
  }

  private timeMutation(result: TimeMutationResult): {
    changeRequestId: string;
    timeEntryId: string;
  } {
    if (result.outcome === 'SUCCESS') return result;
    if (result.outcome === 'FORBIDDEN') throw forbidden();
    if (result.outcome === 'CONFLICT') throw conflict();
    throw notFound();
  }

  private async workMutation(result: WorkMutationResult): Promise<WorkCommandDto> {
    if (result.outcome !== 'SUCCESS') {
      if (result.outcome === 'FORBIDDEN') throw forbidden();
      if (result.outcome === 'CONFLICT') throw conflict();
      throw notFound();
    }
    const handoff =
      result.handoffId === null
        ? null
        : ((await this.repository.listHandoffs(result.changeRequestId))
            .filter((row) => row.id === result.handoffId)
            .map(handoffDto)[0] ?? null);
    return {
      changeRequestId: result.changeRequestId,
      status: result.status,
      updatedAt: result.updatedAt.toISOString(),
      handoff,
    };
  }

  async listTimeEntries(changeRequestId: string, userId: string, limit: number, offset: number) {
    const context = await this.requestContext(changeRequestId, userId);
    if (!canViewTime(context.role)) throw notFound();
    const [rows, activeDurationMinutes] = await Promise.all([
      this.repository.listTimeEntries(changeRequestId, limit, offset),
      this.repository.activeTimeTotal(changeRequestId),
    ]);
    return {
      data: rows.map(timeDto),
      meta: {
        count: rows.length,
        limit,
        offset,
        activeDurationMinutes,
        canCreate: canCreateTime(context.role),
        canVoidOwn: canVoidOwn(context.role),
        canManage: canManageTime(context.role),
      },
    };
  }

  async createTimeEntry(changeRequestId: string, userId: string, input: CreateTimeEntryInput) {
    const context = await this.requestContext(changeRequestId, userId);
    if (!canViewTime(context.role)) throw notFound();
    if (!canCreateTime(context.role)) throw forbidden();
    const result = this.timeMutation(
      await this.repository.createTimeEntry(changeRequestId, userId, input, canCreateTime),
    );
    const row = await this.repository.findTimeEntry(result.changeRequestId, result.timeEntryId);
    if (!row) throw notFound();
    return { data: timeDto(row), meta: {} };
  }

  async voidTimeEntry(timeEntryId: string, userId: string, input: VoidTimeEntryInput) {
    const result = this.timeMutation(
      await this.repository.voidTimeEntry(timeEntryId, userId, input, canViewTime, canVoidOwn, canManageTime),
    );
    const row = await this.repository.findTimeEntry(result.changeRequestId, result.timeEntryId);
    if (!row) throw notFound();
    return { data: timeDto(row), meta: {} };
  }

  async startWork(changeRequestId: string, userId: string, expectedUpdatedAt: string) {
    return {
      data: await this.workMutation(
        await this.repository.startWork(changeRequestId, userId, expectedUpdatedAt, canManageWork),
      ),
      meta: {},
    };
  }

  async createHandoff(changeRequestId: string, userId: string, input: CreateReviewHandoffInput) {
    try {
      return {
        data: await this.workMutation(
          await this.repository.createHandoff(changeRequestId, userId, input, canManageWork),
        ),
        meta: {},
      };
    } catch (error) {
      if (databaseCode(error) === '23505') throw conflict();
      throw error;
    }
  }

  async respondToHandoff(handoffId: string, userId: string, input: RespondToReviewHandoffInput) {
    try {
      return {
        data: await this.workMutation(
          await this.repository.respondToHandoff(handoffId, userId, input, canRespond),
        ),
        meta: {},
      };
    } catch (error) {
      if (databaseCode(error) === '23505') throw conflict();
      throw error;
    }
  }

  async cancel(changeRequestId: string, userId: string, input: CancelChangeRequestInput) {
    return {
      data: await this.workMutation(await this.repository.cancel(changeRequestId, userId, input, canCancel)),
      meta: {},
    };
  }

  async history(changeRequestId: string, userId: string, limit: number, offset: number) {
    const context = await this.requestContext(changeRequestId, userId);
    if (!hasCapability(context.role, 'VIEW_REQUEST_HISTORY')) throw notFound();
    const includeInternal = canViewTime(context.role);
    const sources = await this.repository.historySources(changeRequestId, includeInternal);
    const events: RequestHistoryItem[] = [];
    for (const row of sources.statuses) {
      events.push({
        id: `STATUS_CHANGED:${row.id}`,
        sourceId: row.id,
        kind: 'STATUS_CHANGED',
        eventTime: row.createdAt.toISOString(),
        actorDisplayName: displayName(row.actorFirstName, row.actorLastName),
        previousStatus: row.previousStatus,
        newStatus: row.newStatus,
        note: row.note,
      });
    }
    for (const row of sources.estimateEvents) {
      if (row.submittedAt === null) continue;
      events.push({
        id: `ESTIMATE_SUBMITTED:${row.id}`,
        sourceId: row.id,
        kind: 'ESTIMATE_SUBMITTED',
        eventTime: row.submittedAt.toISOString(),
        actorDisplayName: displayName(row.actorFirstName, row.actorLastName),
        version: row.version,
        estimatedHours: normalizedDecimal(row.estimatedHours),
        hourlyRate: normalizedDecimal(row.hourlyRate),
        estimatedCost: normalizedDecimal(row.estimatedCost),
        scopeNotes: row.scopeNotes,
      });
    }
    for (const row of sources.estimateResponseEvents) {
      events.push({
        id: `ESTIMATE_RESPONDED:${row.id}`,
        sourceId: row.id,
        kind: 'ESTIMATE_RESPONDED',
        eventTime: row.createdAt.toISOString(),
        actorDisplayName: displayName(row.actorFirstName, row.actorLastName),
        version: row.version,
        decision: row.decision,
        note: row.note,
      });
    }
    for (const row of sources.commentEvents) {
      events.push({
        id: `COMMENT:${row.id}`,
        sourceId: row.id,
        kind: 'COMMENT',
        eventTime: row.createdAt.toISOString(),
        actorDisplayName: displayName(row.actorFirstName, row.actorLastName),
        body: row.body,
        visibility: row.visibility,
      });
    }
    for (const row of sources.timeEvents) {
      events.push({
        id: `TIME_CREATED:${row.id}`,
        sourceId: row.id,
        kind: 'TIME_CREATED',
        eventTime: row.createdAt.toISOString(),
        actorDisplayName: displayName(row.authorFirstName, row.authorLastName),
        durationMinutes: row.durationMinutes,
        description: row.description,
        workDate: row.workDate,
      });
      if (
        row.voidedAt !== null &&
        row.voidReason !== null &&
        row.voidedByFirstName !== null &&
        row.voidedByLastName !== null
      ) {
        events.push({
          id: `TIME_VOIDED:${row.id}`,
          sourceId: row.id,
          kind: 'TIME_VOIDED',
          eventTime: row.voidedAt.toISOString(),
          actorDisplayName: displayName(row.voidedByFirstName, row.voidedByLastName),
          durationMinutes: row.durationMinutes,
          reason: row.voidReason,
          originalEntryId: row.id,
        });
      }
    }
    for (const row of sources.handoffs) {
      events.push({
        id: `WORK_HANDOFF:${row.id}`,
        sourceId: row.id,
        kind: 'WORK_HANDOFF',
        eventTime: row.createdAt.toISOString(),
        actorDisplayName: displayName(row.creatorFirstName, row.creatorLastName),
        version: row.version,
        workSummary: row.workSummary,
        releaseNotes: row.releaseNotes,
      });
      if (
        row.responseId !== null &&
        row.responseDecision !== null &&
        row.responseCreatedAt !== null &&
        row.responseFirstName !== null &&
        row.responseLastName !== null
      ) {
        events.push({
          id: `WORK_REVIEW_RESPONSE:${row.responseId}`,
          sourceId: row.responseId,
          kind: 'WORK_REVIEW_RESPONSE',
          eventTime: row.responseCreatedAt.toISOString(),
          actorDisplayName: displayName(row.responseFirstName, row.responseLastName),
          handoffVersion: row.version,
          decision: row.responseDecision,
          note: row.responseNote,
        });
      }
    }
    const order: Record<RequestHistoryItem['kind'], number> = {
      STATUS_CHANGED: 0,
      ESTIMATE_SUBMITTED: 1,
      ESTIMATE_RESPONDED: 2,
      COMMENT: 3,
      TIME_CREATED: 4,
      TIME_VOIDED: 5,
      WORK_HANDOFF: 6,
      WORK_REVIEW_RESPONSE: 7,
    };
    events.sort(
      (left, right) =>
        left.eventTime.localeCompare(right.eventTime) ||
        order[left.kind] - order[right.kind] ||
        left.sourceId.localeCompare(right.sourceId),
    );
    const data = events.slice(offset, offset + limit);
    return {
      data,
      meta: {
        count: data.length,
        limit,
        offset,
        canManageWork: canManageWork(context.role),
        canRespondToReview: canRespond(context.role),
        canCancel: canCancel(context.role),
        canViewPrivateTime: canViewTime(context.role),
        currentHandoff:
          sources.handoffs.length === 0 ? null : handoffDto(sources.handoffs[sources.handoffs.length - 1]!),
      },
    };
  }
}
