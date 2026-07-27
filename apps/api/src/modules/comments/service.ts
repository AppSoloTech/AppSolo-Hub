import type { CommentDto, CommentVisibility, CreateCommentInput, OrganizationRole } from '@appsolo/shared';
import { AppError } from '../../errors.js';
import { hasCapability } from '../access/policy.js';
import { CommentRepository } from './repository.js';

const notFound = () => new AppError('NOT_FOUND', 404, 'The requested resource was not found.');
const forbidden = () =>
  new AppError('FORBIDDEN', 403, 'You do not have permission to use that comment visibility.');

const canViewInternal = (role: OrganizationRole): boolean => hasCapability(role, 'VIEW_INTERNAL_COMMENTS');
const canCreateClient = (role: OrganizationRole): boolean => hasCapability(role, 'CREATE_CLIENT_COMMENTS');
const canCreateInternal = (role: OrganizationRole): boolean =>
  hasCapability(role, 'CREATE_INTERNAL_COMMENTS');
const canCreate = (role: OrganizationRole, visibility: CommentVisibility): boolean =>
  visibility === 'INTERNAL_ONLY' ? canCreateInternal(role) : canCreateClient(role);

type CommentRow = Awaited<ReturnType<CommentRepository['list']>>[number];

const asDto = (row: CommentRow): CommentDto => ({
  id: row.id,
  changeRequestId: row.changeRequestId,
  body: row.body,
  visibility: row.visibility,
  authorDisplayName: `${row.authorFirstName} ${row.authorLastName}`.trim(),
  createdAt: row.createdAt.toISOString(),
});

export class CommentService {
  constructor(private readonly repository: CommentRepository) {}

  private async requestContext(changeRequestId: string, userId: string) {
    const context = await this.repository.findRequestContext(changeRequestId, userId);
    if (!context || !hasCapability(context.role, 'VIEW_COMMENTS')) throw notFound();
    return context;
  }

  async list(changeRequestId: string, userId: string, limit: number, offset: number) {
    const context = await this.requestContext(changeRequestId, userId);
    const internal = canViewInternal(context.role);
    const data = (await this.repository.list(changeRequestId, internal, limit, offset)).map(asDto);
    return {
      data,
      meta: {
        count: data.length,
        limit,
        offset,
        canCreateClientComments: canCreateClient(context.role),
        canViewInternalComments: internal,
        canCreateInternalComments: canCreateInternal(context.role),
      },
    };
  }

  async create(changeRequestId: string, userId: string, input: CreateCommentInput) {
    const context = await this.requestContext(changeRequestId, userId);
    if (!canCreate(context.role, input.visibility)) throw forbidden();
    const result = await this.repository.create(changeRequestId, userId, input, canCreate);
    if (result.outcome === 'NOT_FOUND') throw notFound();
    if (result.outcome === 'FORBIDDEN') throw forbidden();
    const row = await this.repository.findById(
      changeRequestId,
      result.commentId,
      canViewInternal(context.role),
    );
    if (!row) throw notFound();
    return { data: asDto(row), meta: {} };
  }
}
