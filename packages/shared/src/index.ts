import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
export const paginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const changeRequestPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const changeRequestStatuses = [
  'DRAFT',
  'SUBMITTED',
  'AWAITING_ESTIMATE',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'NEEDS_CLARIFICATION',
  'IN_PROGRESS',
  'READY_FOR_REVIEW',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ChangeRequestPriority = (typeof changeRequestPriorities)[number];
export type ChangeRequestStatus = (typeof changeRequestStatuses)[number];

export const createChangeRequestSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(160),
    description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(10000),
    priority: z.enum(changeRequestPriorities).default('NORMAL'),
    requestedCompletionDate: isoDateSchema.nullable().optional(),
  })
  .strict();
export type CreateChangeRequestInput = z.infer<typeof createChangeRequestSchema>;

export const authenticatedUserSchema = z.object({ userId: uuidSchema, email: z.string().email() });
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const userStatuses = ['INVITED', 'ACTIVE', 'SUSPENDED'] as const;
export const organizationTypes = ['INTERNAL', 'CLIENT'] as const;
export const organizationRoles = ['OWNER', 'ADMIN', 'DEVELOPER', 'CLIENT_ADMIN', 'CLIENT_MEMBER'] as const;
export const membershipStatuses = ['ACTIVE', 'SUSPENDED'] as const;
export const invitationStatuses = ['PENDING', 'ACCEPTED', 'REVOKED'] as const;
export const effectiveInvitationStatuses = [...invitationStatuses, 'EXPIRED'] as const;
export const accessEventTypes = [
  'INVITATION_CREATED',
  'INVITATION_RESENT',
  'INVITATION_REVOKED',
  'INVITATION_ACCEPTED',
  'MEMBERSHIP_ROLE_CHANGED',
  'MEMBERSHIP_SUSPENDED',
  'MEMBERSHIP_REACTIVATED',
] as const;
export const capabilities = [
  'VIEW_CHANGE_REQUESTS',
  'SUBMIT_CHANGE_REQUESTS',
  'VIEW_MEMBERS',
  'MANAGE_INVITATIONS',
  'MANAGE_MEMBERSHIPS',
  'VIEW_ACCESS_EVENTS',
] as const;

export type UserStatus = (typeof userStatuses)[number];
export type OrganizationType = (typeof organizationTypes)[number];
export type OrganizationRole = (typeof organizationRoles)[number];
export type MembershipStatus = (typeof membershipStatuses)[number];
export type InvitationStatus = (typeof invitationStatuses)[number];
export type EffectiveInvitationStatus = (typeof effectiveInvitationStatuses)[number];
export type AccessEventType = (typeof accessEventTypes)[number];
export type Capability = (typeof capabilities)[number];

export const developmentSignInSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(320) })
  .strict();
export type DevelopmentSignInInput = z.infer<typeof developmentSignInSchema>;

export const sessionMembershipDtoSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  organizationName: z.string(),
  organizationType: z.enum(organizationTypes),
  role: z.enum(organizationRoles),
  status: z.literal('ACTIVE'),
  capabilities: z.array(z.enum(capabilities)),
  updatedAt: z.string().datetime(),
});
export const sessionDtoSchema = z.object({
  user: z.object({
    id: uuidSchema,
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
  }),
  memberships: z.array(sessionMembershipDtoSchema),
});
export type SessionMembershipDto = z.infer<typeof sessionMembershipDtoSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;

export const memberDtoSchema = z.object({
  membershipId: uuidSchema,
  userId: uuidSchema,
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  userStatus: z.enum(userStatuses),
  role: z.enum(organizationRoles),
  status: z.enum(membershipStatuses),
  capabilities: z.array(z.enum(capabilities)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MemberDto = z.infer<typeof memberDtoSchema>;

export const createInvitationSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(320),
    role: z.enum(organizationRoles),
  })
  .strict();
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationDtoSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  invitedUserId: uuidSchema,
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(organizationRoles),
  status: z.enum(effectiveInvitationStatuses),
  invitedByUserId: uuidSchema,
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  resentAt: z.string().datetime().nullable(),
  resendCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InvitationDto = z.infer<typeof invitationDtoSchema>;
export type InvitationMutationDto = {
  invitation: InvitationDto;
  acceptanceUrl?: string;
};

export const acceptInvitationSchema = z.object({ token: z.string().min(43).max(512) }).strict();
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const updateMembershipSchema = z
  .object({
    role: z.enum(organizationRoles).optional(),
    status: z.enum(membershipStatuses).optional(),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict()
  .refine((input) => Number(input.role !== undefined) + Number(input.status !== undefined) === 1, {
    message: 'Exactly one role or status change is required.',
  });
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;

export const accessEventDtoSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  eventType: z.enum(accessEventTypes),
  actorUserId: uuidSchema.nullable(),
  actorName: z.string().nullable(),
  subjectUserId: uuidSchema,
  subjectName: z.string(),
  invitationId: uuidSchema.nullable(),
  membershipId: uuidSchema.nullable(),
  previousRole: z.enum(organizationRoles).nullable(),
  newRole: z.enum(organizationRoles).nullable(),
  previousStatus: z.enum(membershipStatuses).nullable(),
  newStatus: z.enum(membershipStatuses).nullable(),
  createdAt: z.string().datetime(),
});
export type AccessEventDto = z.infer<typeof accessEventDtoSchema>;

export const changeRequestDtoSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  submittedByUserId: uuidSchema,
  title: z.string(),
  description: z.string(),
  priority: z.enum(changeRequestPriorities),
  status: z.enum(changeRequestStatuses),
  requestedCompletionDate: isoDateSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ChangeRequestDto = z.infer<typeof changeRequestDtoSchema>;

export type ErrorDetail = { path: string; message: string };
export type SuccessEnvelope<T> = { data: T; meta: Record<string, unknown> };
export type ErrorEnvelope = {
  error: { code: string; message: string; details: ErrorDetail[]; requestId?: string };
};

export interface AttachmentStorage {
  createUploadTarget(input: {
    changeRequestId: string;
    filename: string;
    mimeType: string;
  }): Promise<{ storageKey: string; url: string }>;
  createDownloadTarget(input: { storageKey: string }): Promise<{ url: string }>;
  deleteObject(storageKey: string): Promise<void>;
}
