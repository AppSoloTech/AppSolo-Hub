import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '@appsolo/database';
import { organizationMemberships, organizations } from '@appsolo/database/schema';

export class SessionRepository {
  constructor(private readonly db: Database) {}

  async findActiveUserById(id: string) {
    return this.db.query.users.findFirst({
      where: (user, operators) =>
        operators.and(operators.eq(user.id, id), operators.eq(user.status, 'ACTIVE')),
    });
  }

  async findActiveUserByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: (user, operators) =>
        operators.and(operators.eq(user.email, email), operators.eq(user.status, 'ACTIVE')),
    });
  }

  async listActiveMemberships(userId: string) {
    return this.db
      .select({
        id: organizationMemberships.id,
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationType: organizations.type,
        role: organizationMemberships.role,
        status: organizationMemberships.status,
        updatedAt: organizationMemberships.updatedAt,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, 'ACTIVE'),
          eq(organizations.status, 'ACTIVE'),
        ),
      )
      .orderBy(asc(organizations.name), asc(organizations.id));
  }
}
