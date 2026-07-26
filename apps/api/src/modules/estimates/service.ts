import {
  calculateEstimatedCost,
  type CreateEstimateInput,
  type EstimateDto,
  type OrganizationRole,
  type RespondToEstimateInput,
  type UpdateEstimateInput,
} from '@appsolo/shared';
import { AppError, validationError } from '../../errors.js';
import { hasCapability } from '../access/policy.js';
import { EstimateRepository, type MutationResult } from './repository.js';

const notFound = () => new AppError('NOT_FOUND', 404, 'The requested resource was not found.');
const forbidden = () => new AppError('FORBIDDEN', 403, 'You do not have permission to manage estimates.');
const conflict = () =>
  new AppError('CONFLICT', 409, 'The estimate changed or is no longer actionable. Refresh and try again.');

const displayName = (firstName: string, lastName: string): string => `${firstName} ${lastName}`.trim();
const normalizeDatabaseDecimal = (value: string): string => {
  const [integer = '0', fraction = ''] = value.split('.');
  return `${integer}.${fraction.padEnd(2, '0')}`;
};

type EstimateRow = Awaited<ReturnType<EstimateRepository['list']>>[number];

const asDto = (row: EstimateRow): EstimateDto => ({
  id: row.id,
  changeRequestId: row.changeRequestId,
  version: row.version,
  estimatedHours: normalizeDatabaseDecimal(row.estimatedHours),
  hourlyRate: normalizeDatabaseDecimal(row.hourlyRate),
  estimatedCost: normalizeDatabaseDecimal(row.estimatedCost),
  scopeNotes: row.scopeNotes,
  status: row.status,
  creatorDisplayName: displayName(row.creatorFirstName, row.creatorLastName),
  submittedAt: row.submittedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  response:
    row.responseDecision && row.responseCreatedAt && row.responseFirstName && row.responseLastName
      ? {
          decision: row.responseDecision,
          note: row.responseNote,
          actorDisplayName: displayName(row.responseFirstName, row.responseLastName),
          createdAt: row.responseCreatedAt.toISOString(),
        }
      : null,
});

const manages = (role: OrganizationRole): boolean => hasCapability(role, 'MANAGE_ESTIMATES');
const responds = (role: OrganizationRole): boolean => hasCapability(role, 'RESPOND_TO_ESTIMATES');

const databaseCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'cause' in error ? databaseCode(error.cause) : undefined;
};

export class EstimateService {
  constructor(private readonly repository: EstimateRepository) {}

  private async requestContext(changeRequestId: string, userId: string) {
    const context = await this.repository.findRequestContext(changeRequestId, userId);
    if (!context) throw notFound();
    if (!hasCapability(context.role, 'VIEW_ESTIMATES')) throw forbidden();
    return context;
  }

  private handleMutation(result: MutationResult): string {
    if (result.outcome === 'SUCCESS') return result.estimateId;
    if (result.outcome === 'FORBIDDEN') throw forbidden();
    if (result.outcome === 'CONFLICT') throw conflict();
    throw notFound();
  }

  private calculate(input: CreateEstimateInput | UpdateEstimateInput): string {
    try {
      return calculateEstimatedCost(input.estimatedHours, input.hourlyRate);
    } catch (error) {
      throw validationError([
        {
          path: 'hourlyRate',
          message: error instanceof Error ? error.message : 'The calculated cost is invalid.',
        },
      ]);
    }
  }

  private async mutationDto(
    estimateId: string,
    changeRequestId: string,
    userId: string,
  ): Promise<EstimateDto> {
    const context = await this.requestContext(changeRequestId, userId);
    const rows = await this.repository.list(changeRequestId, manages(context.role));
    const row = rows.find((candidate) => candidate.id === estimateId);
    if (!row) throw notFound();
    return asDto(row);
  }

  async list(changeRequestId: string, userId: string) {
    const context = await this.requestContext(changeRequestId, userId);
    const data = (await this.repository.list(changeRequestId, manages(context.role))).map(asDto);
    return {
      data,
      meta: {
        count: data.length,
        canManage: manages(context.role),
        canRespond: responds(context.role),
      },
    };
  }

  async create(changeRequestId: string, userId: string, input: CreateEstimateInput) {
    const context = await this.requestContext(changeRequestId, userId);
    if (!manages(context.role)) throw forbidden();
    try {
      const estimateId = this.handleMutation(
        await this.repository.createDraft(changeRequestId, userId, input, this.calculate(input), manages),
      );
      return { data: await this.mutationDto(estimateId, changeRequestId, userId), meta: {} };
    } catch (error) {
      if (databaseCode(error) === '23505') throw conflict();
      throw error;
    }
  }

  async update(estimateId: string, userId: string, input: UpdateEstimateInput) {
    try {
      const estimateIdResult = this.handleMutation(
        await this.repository.updateDraft(estimateId, userId, input, this.calculate(input), manages),
      );
      const context = await this.repository.findRequestContextForEstimate(estimateIdResult, userId);
      if (!context) throw notFound();
      return {
        data: await this.mutationDto(estimateIdResult, context.changeRequestId, userId),
        meta: {},
      };
    } catch (error) {
      if (databaseCode(error) === '23505') throw conflict();
      throw error;
    }
  }

  async submit(estimateId: string, userId: string, expectedUpdatedAt: string) {
    try {
      const estimateIdResult = this.handleMutation(
        await this.repository.submitDraft(estimateId, userId, expectedUpdatedAt, manages),
      );
      const context = await this.repository.findRequestContextForEstimate(estimateIdResult, userId);
      if (!context) throw notFound();
      return {
        data: await this.mutationDto(estimateIdResult, context.changeRequestId, userId),
        meta: {},
      };
    } catch (error) {
      if (databaseCode(error) === '23505') throw conflict();
      throw error;
    }
  }

  async respond(estimateId: string, userId: string, input: RespondToEstimateInput) {
    try {
      const estimateIdResult = this.handleMutation(
        await this.repository.respond(estimateId, userId, input, responds),
      );
      const context = await this.repository.findRequestContextForEstimate(estimateIdResult, userId);
      if (!context) throw notFound();
      return {
        data: await this.mutationDto(estimateIdResult, context.changeRequestId, userId),
        meta: {},
      };
    } catch (error) {
      if (databaseCode(error) === '23505') throw conflict();
      throw error;
    }
  }
}
