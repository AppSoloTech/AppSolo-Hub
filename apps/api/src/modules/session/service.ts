import type { SessionDto } from '@appsolo/shared';
import { AppError } from '../../errors.js';
import { capabilitiesForRole } from '../access/policy.js';
import type { SessionRepository } from './repository.js';

export class SessionService {
  constructor(private readonly repository: SessionRepository) {}

  async developmentSignIn(email: string): Promise<SessionDto> {
    const user = await this.repository.findActiveUserByEmail(email);
    if (!user) {
      throw new AppError('UNAUTHENTICATED', 401, 'Development sign-in was not accepted.');
    }
    return this.forUser(user.id);
  }

  async forUser(userId: string): Promise<SessionDto> {
    const user = await this.repository.findActiveUserById(userId);
    if (!user) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
    const memberships = await this.repository.listActiveMemberships(userId);
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      memberships: memberships.map((membership) => ({
        ...membership,
        status: 'ACTIVE',
        capabilities: capabilitiesForRole(membership.role),
        updatedAt: membership.updatedAt.toISOString(),
      })),
    };
  }
}
