import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '@appsolo/database';
import { changeRequests, organizationMemberships, organizations, projects, statusHistory } from '@appsolo/database/schema';
import type { CreateChangeRequestInput } from '@appsolo/shared';

export type ProjectScope = { projectId: string; organizationId: string; projectName: string; organizationName: string };
export class ChangeRequestRepository {
  constructor(private readonly db: Database) {}
  async findActiveUser(id: string) { return this.db.query.users.findFirst({ where: (user, { and, eq }) => and(eq(user.id, id), eq(user.status, 'ACTIVE')) }); }
  async findProjectScope(projectId: string, userId: string): Promise<ProjectScope | undefined> {
    const row = await this.db.select({ projectId: projects.id, organizationId: organizations.id, projectName: projects.name, organizationName: organizations.name }).from(projects).innerJoin(organizations, eq(projects.organizationId, organizations.id)).innerJoin(organizationMemberships, and(eq(organizationMemberships.organizationId, organizations.id), eq(organizationMemberships.userId, userId))).where(and(eq(projects.id, projectId), eq(projects.status, 'ACTIVE'), eq(organizations.type, 'CLIENT'), eq(organizations.status, 'ACTIVE'))).limit(1);
    return row[0];
  }
  async findRequestProject(changeRequestId: string) { return this.db.select({ projectId: projects.id }).from(changeRequests).innerJoin(projects, eq(changeRequests.projectId, projects.id)).where(eq(changeRequests.id, changeRequestId)).limit(1); }
  async list(scope: ProjectScope, limit: number, offset: number) { return this.db.select().from(changeRequests).where(eq(changeRequests.projectId, scope.projectId)).orderBy(desc(changeRequests.createdAt), desc(changeRequests.id)).limit(limit).offset(offset); }
  async findById(scope: ProjectScope, id: string) { return this.db.query.changeRequests.findFirst({ where: and(eq(changeRequests.id, id), eq(changeRequests.projectId, scope.projectId)) }); }
  async create(scope: ProjectScope, submittedByUserId: string, input: CreateChangeRequestInput) {
    return this.db.transaction(async (tx) => {
      const [request] = await tx.insert(changeRequests).values({ projectId: scope.projectId, submittedByUserId, title: input.title, description: input.description, priority: input.priority, requestedCompletionDate: input.requestedCompletionDate ?? null, status: 'SUBMITTED' }).returning();
      if (!request) throw new Error('Change request insert did not return a record.');
      await tx.insert(statusHistory).values({ changeRequestId: request.id, changedByUserId: submittedByUserId, newStatus: 'SUBMITTED' });
      return request;
    });
  }
}
