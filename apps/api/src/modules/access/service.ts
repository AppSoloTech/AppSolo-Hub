import { createHash, randomBytes } from 'node:crypto';
import type {
  CreateInvitationInput,
  EffectiveInvitationStatus,
  InvitationDto,
  MemberDto,
  OrganizationRole,
  SessionDto,
  UpdateMembershipInput,
} from '@appsolo/shared';
import { AppError } from '../../errors.js';
import type { SessionService } from '../session/service.js';
import { canAssignRole, capabilitiesForRole, hasCapability, isRoleAllowedForOrganization } from './policy.js';
import { AccessRepository, AccessStateError } from './repository.js';

export type TokenGenerator = () => string;
export type Clock = () => Date;
const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000;
const tokenHash = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

const forbidden = () => new AppError('FORBIDDEN', 403, 'You do not have access to manage this organization.');
const inaccessible = () => new AppError('NOT_FOUND', 404, 'The requested resource was not found.');
const conflict = (message: string) => new AppError('CONFLICT', 409, message);

export class AccessService {
  constructor(
    private readonly repository: AccessRepository,
    private readonly sessionService: SessionService,
    private readonly webOrigin: string,
    private readonly clock: Clock = () => new Date(),
    private readonly tokenGenerator: TokenGenerator = () => randomBytes(32).toString('base64url'),
  ) {}

  private async authorize(
    organizationId: string,
    actorUserId: string,
    capability: 'VIEW_MEMBERS' | 'MANAGE_INVITATIONS' | 'MANAGE_MEMBERSHIPS' | 'VIEW_ACCESS_EVENTS',
  ) {
    const context = await this.repository.findAccessContext(organizationId, actorUserId);
    if (!context || !hasCapability(context.actorRole, capability)) throw forbidden();
    return context;
  }

  private assertInvitationRole(
    context: {
      organizationType: 'INTERNAL' | 'CLIENT';
      actorRole: OrganizationRole;
    },
    targetRole: OrganizationRole,
    currentMembershipRole?: OrganizationRole,
  ): void {
    if (
      !hasCapability(context.actorRole, 'MANAGE_INVITATIONS') ||
      !canAssignRole(context.actorRole, targetRole) ||
      (currentMembershipRole !== undefined && !canAssignRole(context.actorRole, currentMembershipRole)) ||
      !isRoleAllowedForOrganization(context.organizationType, targetRole)
    ) {
      throw forbidden();
    }
  }

  private effectiveStatus(
    stored: 'PENDING' | 'ACCEPTED' | 'REVOKED',
    expiresAt: Date,
  ): EffectiveInvitationStatus {
    return stored === 'PENDING' && expiresAt.getTime() <= this.clock().getTime() ? 'EXPIRED' : stored;
  }

  private invitationDto(row: {
    id: string;
    organizationId: string;
    invitedUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: OrganizationRole;
    status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
    invitedByUserId: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
    resentAt: Date | null;
    resendCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): InvitationDto {
    return {
      ...row,
      status: this.effectiveStatus(row.status, row.expiresAt),
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      resentAt: row.resentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private invitationResult(
    result: {
      invitation: {
        id: string;
        organizationId: string;
        invitedUserId: string;
        email: string;
        proposedRole: OrganizationRole;
        invitedByUserId: string;
        status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
        expiresAt: Date;
        acceptedAt: Date | null;
        revokedAt: Date | null;
        resentAt: Date | null;
        resendCount: number;
        createdAt: Date;
        updatedAt: Date;
      };
      invitedUser: { firstName: string; lastName: string };
    },
    acceptanceUrl?: string,
  ) {
    const invitation = result.invitation;
    return {
      invitation: this.invitationDto({
        id: invitation.id,
        organizationId: invitation.organizationId,
        invitedUserId: invitation.invitedUserId,
        email: invitation.email,
        firstName: result.invitedUser.firstName,
        lastName: result.invitedUser.lastName,
        role: invitation.proposedRole,
        status: invitation.status,
        invitedByUserId: invitation.invitedByUserId,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
        resentAt: invitation.resentAt,
        resendCount: invitation.resendCount,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
      }),
      ...(acceptanceUrl ? { acceptanceUrl } : {}),
    };
  }

  private mapStateError(error: unknown): never {
    if (!(error instanceof AccessStateError)) throw error;
    if (error.state === 'INVITATION_EXPIRED') {
      throw new AppError('INVITATION_EXPIRED', 410, 'This invitation has expired.');
    }
    if (error.state === 'INVITATION_INVALID') {
      throw new AppError('INVITATION_INVALID', 400, 'This invitation is invalid.');
    }
    if (error.state === 'INVITATION_NOT_FOUND' || error.state === 'MEMBERSHIP_NOT_FOUND') {
      throw inaccessible();
    }
    if (error.state === 'INVITATION_STALE') {
      throw conflict('This invitation is no longer pending.');
    }
    if (error.state === 'MEMBERSHIP_STALE') {
      throw conflict('This membership changed. Refresh and try again.');
    }
    if (error.state === 'DUPLICATE_INVITATION') {
      throw conflict('A pending invitation already exists for this email and organization.');
    }
    if (error.state === 'EXISTING_MEMBERSHIP') {
      throw conflict('This user already has an active membership in the organization.');
    }
    if (error.state === 'GLOBAL_USER_SUSPENDED') {
      throw conflict('This user cannot be invited.');
    }
    if (error.state === 'LAST_OWNER') {
      throw conflict('The organization must retain at least one active owner.');
    }
    throw conflict('The requested access change conflicts with current state.');
  }

  async listMembers(organizationId: string, actorUserId: string, limit: number, offset: number) {
    await this.authorize(organizationId, actorUserId, 'VIEW_MEMBERS');
    const rows = await this.repository.listMembers(organizationId, limit, offset);
    const data: MemberDto[] = rows.map((row) => ({
      ...row,
      capabilities:
        row.status === 'ACTIVE' && row.userStatus === 'ACTIVE' ? capabilitiesForRole(row.role) : [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
    return { data, meta: { count: data.length, limit, offset } };
  }

  async listInvitations(organizationId: string, actorUserId: string, limit: number, offset: number) {
    await this.authorize(organizationId, actorUserId, 'MANAGE_INVITATIONS');
    const rows = await this.repository.listInvitations(organizationId, limit, offset);
    return {
      data: rows.map((row) => this.invitationDto(row)),
      meta: { count: rows.length, limit, offset },
    };
  }

  async createInvitation(organizationId: string, actorUserId: string, input: CreateInvitationInput) {
    await this.authorize(organizationId, actorUserId, 'MANAGE_INVITATIONS');
    const token = this.tokenGenerator();
    const now = this.clock();
    try {
      const result = await this.repository.createInvitation({
        organizationId,
        actorUserId,
        invitation: input,
        tokenHash: tokenHash(token),
        expiresAt: new Date(now.getTime() + sevenDaysInMilliseconds),
        authorize: (context, role, currentMembershipRole) =>
          this.assertInvitationRole(context, role, currentMembershipRole),
      });
      return {
        data: this.invitationResult(
          result,
          `${this.webOrigin}/invitations/accept#token=${encodeURIComponent(token)}`,
        ),
        meta: {},
      };
    } catch (error: unknown) {
      return this.mapStateError(error);
    }
  }

  async resendInvitation(organizationId: string, invitationId: string, actorUserId: string) {
    await this.authorize(organizationId, actorUserId, 'MANAGE_INVITATIONS');
    const token = this.tokenGenerator();
    const now = this.clock();
    try {
      const result = await this.repository.resendInvitation({
        organizationId,
        invitationId,
        actorUserId,
        tokenHash: tokenHash(token),
        expiresAt: new Date(now.getTime() + sevenDaysInMilliseconds),
        authorize: (context, role, currentMembershipRole) =>
          this.assertInvitationRole(context, role, currentMembershipRole),
      });
      return {
        data: this.invitationResult(
          result,
          `${this.webOrigin}/invitations/accept#token=${encodeURIComponent(token)}`,
        ),
        meta: {},
      };
    } catch (error: unknown) {
      return this.mapStateError(error);
    }
  }

  async revokeInvitation(organizationId: string, invitationId: string, actorUserId: string) {
    await this.authorize(organizationId, actorUserId, 'MANAGE_INVITATIONS');
    try {
      const result = await this.repository.revokeInvitation({
        organizationId,
        invitationId,
        actorUserId,
        authorize: (context, role) => this.assertInvitationRole(context, role),
      });
      return { data: this.invitationResult(result), meta: {} };
    } catch (error: unknown) {
      return this.mapStateError(error);
    }
  }

  async acceptInvitation(token: string): Promise<{ data: SessionDto; meta: Record<string, never> }> {
    try {
      const accepted = await this.repository.acceptInvitation(
        tokenHash(token),
        this.clock(),
        (context, role, currentMembershipRole) =>
          this.assertInvitationRole(context, role, currentMembershipRole),
      );
      return { data: await this.sessionService.forUser(accepted.userId), meta: {} };
    } catch (error: unknown) {
      return this.mapStateError(error);
    }
  }

  async updateMembership(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    update: UpdateMembershipInput,
  ) {
    await this.authorize(organizationId, actorUserId, 'MANAGE_MEMBERSHIPS');
    try {
      const result = await this.repository.updateMembership({
        organizationId,
        membershipId,
        actorUserId,
        update,
        authorize: (context, target, requested) => {
          if (!hasCapability(context.actorRole, 'MANAGE_MEMBERSHIPS')) throw forbidden();
          const nextRole = requested.role ?? target.role;
          if (
            !canAssignRole(context.actorRole, target.role) ||
            !canAssignRole(context.actorRole, nextRole) ||
            !isRoleAllowedForOrganization(context.organizationType, nextRole)
          ) {
            throw forbidden();
          }
          if (target.userId === actorUserId && requested.status === 'SUSPENDED') {
            throw conflict('You cannot suspend your own membership.');
          }
        },
      });
      const data: MemberDto = {
        membershipId: result.membership.id,
        userId: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        userStatus: result.user.status,
        role: result.membership.role,
        status: result.membership.status,
        capabilities:
          result.membership.status === 'ACTIVE' && result.user.status === 'ACTIVE'
            ? capabilitiesForRole(result.membership.role)
            : [],
        createdAt: result.membership.createdAt.toISOString(),
        updatedAt: result.membership.updatedAt.toISOString(),
      };
      return { data, meta: {} };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      return this.mapStateError(error);
    }
  }

  async listAccessEvents(organizationId: string, actorUserId: string, limit: number, offset: number) {
    await this.authorize(organizationId, actorUserId, 'VIEW_ACCESS_EVENTS');
    const rows = await this.repository.listAccessEvents(organizationId, limit, offset);
    return {
      data: rows.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        eventType: row.eventType,
        actorUserId: row.actorUserId,
        actorName:
          row.actorFirstName && row.actorLastName ? `${row.actorFirstName} ${row.actorLastName}` : null,
        subjectUserId: row.subjectUserId,
        subjectName: `${row.subjectFirstName} ${row.subjectLastName}`,
        invitationId: row.invitationId,
        membershipId: row.membershipId,
        previousRole: row.previousRole,
        newRole: row.newRole,
        previousStatus: row.previousStatus,
        newStatus: row.newStatus,
        createdAt: row.createdAt.toISOString(),
      })),
      meta: { count: rows.length, limit, offset },
    };
  }
}
