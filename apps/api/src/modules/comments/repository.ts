import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '@appsolo/database';
import {
  changeRequests,
  comments,
  organizationMemberships,
  organizations,
  projects,
  users,
} from '@appsolo/database/schema';
import type { CommentVisibility, CreateCommentInput, OrganizationRole } from '@appsolo/shared';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type CommentRequestContext = {
  changeRequestId: string;
  organizationId: string;
  role: OrganizationRole;
};

export type CreateCommentResult =
  { outcome: 'SUCCESS'; commentId: string } | { outcome: 'NOT_FOUND' } | { outcome: 'FORBIDDEN' };

export class CommentRepository {
  constructor(private readonly db: Database) {}

  private requestContextQuery(database: Database | Transaction, changeRequestId: string, userId: string) {
    return database
      .select({
        changeRequestId: changeRequests.id,
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
  ): Promise<CommentRequestContext | undefined> {
    const rows = await this.requestContextQuery(this.db, changeRequestId, userId);
    return rows[0];
  }

  async list(changeRequestId: string, includeInternal: boolean, limit: number, offset: number) {
    return this.db
      .select({
        id: comments.id,
        changeRequestId: comments.changeRequestId,
        body: comments.body,
        visibility: comments.visibility,
        createdAt: comments.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorUserId, users.id))
      .where(
        includeInternal
          ? eq(comments.changeRequestId, changeRequestId)
          : and(eq(comments.changeRequestId, changeRequestId), eq(comments.visibility, 'CLIENT_VISIBLE')),
      )
      .orderBy(asc(comments.createdAt), asc(comments.id))
      .limit(limit)
      .offset(offset);
  }

  async findById(changeRequestId: string, commentId: string, includeInternal: boolean) {
    const rows = await this.db
      .select({
        id: comments.id,
        changeRequestId: comments.changeRequestId,
        body: comments.body,
        visibility: comments.visibility,
        createdAt: comments.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorUserId, users.id))
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.changeRequestId, changeRequestId),
          includeInternal ? undefined : eq(comments.visibility, 'CLIENT_VISIBLE'),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async create(
    changeRequestId: string,
    userId: string,
    input: CreateCommentInput,
    canCreate: (role: OrganizationRole, visibility: CommentVisibility) => boolean,
  ): Promise<CreateCommentResult> {
    return this.db.transaction(async (tx) => {
      const contexts = await this.requestContextQuery(tx, changeRequestId, userId).for('share', {
        of: [changeRequests, organizationMemberships],
      });
      const context = contexts[0];
      if (!context) return { outcome: 'NOT_FOUND' };
      if (!canCreate(context.role, input.visibility)) return { outcome: 'FORBIDDEN' };
      const [created] = await tx
        .insert(comments)
        .values({
          changeRequestId,
          authorUserId: userId,
          body: input.body,
          visibility: input.visibility,
        })
        .returning({ id: comments.id });
      if (!created) throw new Error('Comment insert did not return a record.');
      return { outcome: 'SUCCESS', commentId: created.id };
    });
  }
}
