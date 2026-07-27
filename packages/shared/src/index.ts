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
  'VIEW_COMMENTS',
  'CREATE_CLIENT_COMMENTS',
  'VIEW_INTERNAL_COMMENTS',
  'CREATE_INTERNAL_COMMENTS',
  'VIEW_ESTIMATES',
  'MANAGE_ESTIMATES',
  'RESPOND_TO_ESTIMATES',
  'VIEW_MEMBERS',
  'MANAGE_INVITATIONS',
  'MANAGE_MEMBERSHIPS',
  'VIEW_ACCESS_EVENTS',
  'VIEW_REQUEST_HISTORY',
  'VIEW_PRIVATE_TIME',
  'CREATE_PRIVATE_TIME',
  'VOID_OWN_PRIVATE_TIME',
  'MANAGE_PRIVATE_TIME',
  'MANAGE_REQUEST_WORK',
  'RESPOND_TO_WORK_REVIEW',
  'CANCEL_REQUESTS',
] as const;

export type UserStatus = (typeof userStatuses)[number];
export type OrganizationType = (typeof organizationTypes)[number];
export type OrganizationRole = (typeof organizationRoles)[number];
export type MembershipStatus = (typeof membershipStatuses)[number];
export type InvitationStatus = (typeof invitationStatuses)[number];
export type EffectiveInvitationStatus = (typeof effectiveInvitationStatuses)[number];
export type AccessEventType = (typeof accessEventTypes)[number];
export type Capability = (typeof capabilities)[number];

export const commentVisibilities = ['CLIENT_VISIBLE', 'INTERNAL_ONLY'] as const;
export type CommentVisibility = (typeof commentVisibilities)[number];

export const p005PaginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const commentPaginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

const safeTextSchema = (schema: z.ZodString) =>
  schema.refine((value) => !value.includes('\u0000'), 'Comment contains an unsupported character.');

const safeDomainTextSchema = (schema: z.ZodString, label: string) =>
  schema.refine((value) => !value.includes('\u0000'), `${label} contains an unsupported character.`);

export const createCommentSchema = z
  .object({
    body: safeTextSchema(
      z.string().trim().min(1, 'Comment is required.').max(5000, 'Comment must be at most 5,000 characters.'),
    ),
    visibility: z.enum(commentVisibilities),
  })
  .strict();
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const commentDtoSchema = z.object({
  id: uuidSchema,
  changeRequestId: uuidSchema,
  body: z.string(),
  visibility: z.enum(commentVisibilities),
  authorDisplayName: z.string(),
  createdAt: z.string().datetime(),
});
export type CommentDto = z.infer<typeof commentDtoSchema>;

export const commentListMetaSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().nonnegative(),
  canCreateClientComments: z.boolean(),
  canViewInternalComments: z.boolean(),
  canCreateInternalComments: z.boolean(),
});
export type CommentListMeta = z.infer<typeof commentListMetaSchema>;

export const estimateStatuses = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'NEEDS_CLARIFICATION',
  'SUPERSEDED',
] as const;
export const estimateResponseDecisions = ['APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED'] as const;
export const estimateResponseCommands = ['APPROVE', 'REJECT', 'REQUEST_CLARIFICATION'] as const;
export type EstimateStatus = (typeof estimateStatuses)[number];
export type EstimateResponseDecision = (typeof estimateResponseDecisions)[number];
export type EstimateResponseCommand = (typeof estimateResponseCommands)[number];

const decimalSyntax = /^\d+(?:\.\d{1,2})?$/;

function normalizeFixedScaleDecimal(value: string, integerDigits: number, positive: boolean): string {
  if (!decimalSyntax.test(value))
    throw new Error('Use a plain decimal string with at most two decimal places.');
  const [rawInteger = '', rawFraction = ''] = value.split('.');
  const integer = rawInteger.replace(/^0+(?=\d)/, '');
  if (integer.length > integerDigits) throw new Error('The value is too large.');
  const normalized = `${integer}.${rawFraction.padEnd(2, '0')}`;
  if (positive && BigInt(integer + rawFraction.padEnd(2, '0')) === 0n)
    throw new Error('The value must be greater than 0.00.');
  return normalized;
}

const decimalStringSchema = (integerDigits: number, positive: boolean) =>
  z.string().transform((value, context) => {
    try {
      return normalizeFixedScaleDecimal(value, integerDigits, positive);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : 'Invalid decimal value.',
      });
      return z.NEVER;
    }
  });

export const estimatedHoursSchema = decimalStringSchema(6, true);
export const hourlyRateSchema = decimalStringSchema(10, false);
export const normalizedDecimalSchema = z.string().regex(/^\d+\.\d{2}$/);

const MAX_COST_CENTS = 999_999_999_999n;

export function calculateEstimatedCost(estimatedHours: string, hourlyRate: string): string {
  const hours = estimatedHoursSchema.parse(estimatedHours);
  const rate = hourlyRateSchema.parse(hourlyRate);
  const hoursHundredths = BigInt(hours.replace('.', ''));
  const rateCents = BigInt(rate.replace('.', ''));
  const product = hoursHundredths * rateCents;
  const roundedCents = product / 100n + (product % 100n >= 50n ? 1n : 0n);
  if (roundedCents > MAX_COST_CENTS) throw new Error('The calculated cost is too large.');
  const digits = roundedCents.toString().padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

const estimateTermsSchema = z.object({
  estimatedHours: estimatedHoursSchema,
  hourlyRate: hourlyRateSchema,
  scopeNotes: z.string().trim().min(10, 'Scope notes must be at least 10 characters.').max(10000),
});
export const createEstimateSchema = estimateTermsSchema.strict();
export const updateEstimateSchema = estimateTermsSchema
  .extend({ expectedUpdatedAt: z.string().datetime() })
  .strict();
export const submitEstimateSchema = z.object({ expectedUpdatedAt: z.string().datetime() }).strict();
const approvalResponseSchema = z
  .object({
    decision: z.literal('APPROVE'),
    note: z.string().trim().max(2000).optional(),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();
const rejectionResponseSchema = z
  .object({
    decision: z.literal('REJECT'),
    note: z.string().trim().min(3, 'A reason of at least 3 characters is required.').max(2000),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();
const clarificationResponseSchema = z
  .object({
    decision: z.literal('REQUEST_CLARIFICATION'),
    note: z.string().trim().min(3, 'A reason of at least 3 characters is required.').max(2000),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();
export const respondToEstimateSchema = z.discriminatedUnion('decision', [
  approvalResponseSchema,
  rejectionResponseSchema,
  clarificationResponseSchema,
]);
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;
export type SubmitEstimateInput = z.infer<typeof submitEstimateSchema>;
export type RespondToEstimateInput = z.infer<typeof respondToEstimateSchema>;

export const estimateResponseDtoSchema = z.object({
  decision: z.enum(estimateResponseDecisions),
  note: z.string().nullable(),
  actorDisplayName: z.string(),
  createdAt: z.string().datetime(),
});
export const estimateDtoSchema = z.object({
  id: uuidSchema,
  changeRequestId: uuidSchema,
  version: z.number().int().positive(),
  estimatedHours: normalizedDecimalSchema,
  hourlyRate: normalizedDecimalSchema,
  estimatedCost: normalizedDecimalSchema,
  scopeNotes: z.string(),
  status: z.enum(estimateStatuses),
  creatorDisplayName: z.string(),
  submittedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  response: estimateResponseDtoSchema.nullable(),
});
export type EstimateResponseDto = z.infer<typeof estimateResponseDtoSchema>;
export type EstimateDto = z.infer<typeof estimateDtoSchema>;
export const estimateListMetaSchema = z.object({
  count: z.number().int().nonnegative(),
  canManage: z.boolean(),
  canRespond: z.boolean(),
});
export type EstimateListMeta = z.infer<typeof estimateListMetaSchema>;

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    if (year === undefined || month === undefined || day === undefined) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, 'Use a valid calendar date.');

export const createTimeEntrySchema = z
  .object({
    durationMinutes: z
      .number()
      .int('Duration must be a whole number of minutes.')
      .min(1, 'Duration must be at least 1 minute.')
      .max(1440, 'Duration must be at most 1,440 minutes.'),
    description: safeDomainTextSchema(
      z
        .string()
        .trim()
        .min(3, 'Description must be at least 3 characters.')
        .max(2000, 'Description must be at most 2,000 characters.'),
      'Description',
    ),
    workDate: calendarDateSchema,
  })
  .strict();
export const voidTimeEntrySchema = z
  .object({
    reason: safeDomainTextSchema(
      z
        .string()
        .trim()
        .min(3, 'A void reason of at least 3 characters is required.')
        .max(2000, 'Void reason must be at most 2,000 characters.'),
      'Void reason',
    ),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();
export const startWorkSchema = z.object({ expectedUpdatedAt: z.string().datetime() }).strict();
export const createReviewHandoffSchema = z
  .object({
    workSummary: safeDomainTextSchema(
      z
        .string()
        .trim()
        .min(10, 'Work summary must be at least 10 characters.')
        .max(5000, 'Work summary must be at most 5,000 characters.'),
      'Work summary',
    ),
    releaseNotes: safeDomainTextSchema(
      z
        .string()
        .trim()
        .min(3, 'Release notes must be at least 3 characters.')
        .max(5000, 'Release notes must be at most 5,000 characters.'),
      'Release notes',
    )
      .optional()
      .transform((value) => value || undefined),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();
const acceptWorkReviewSchema = z
  .object({
    decision: z.literal('ACCEPT'),
    note: safeDomainTextSchema(
      z.string().trim().max(2000, 'Completion note must be at most 2,000 characters.'),
      'Completion note',
    )
      .optional()
      .transform((value) => value || undefined),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();
const requestWorkChangesSchema = z
  .object({
    decision: z.literal('REQUEST_CHANGES'),
    note: safeDomainTextSchema(
      z
        .string()
        .trim()
        .min(3, 'A change reason of at least 3 characters is required.')
        .max(2000, 'Change reason must be at most 2,000 characters.'),
      'Change reason',
    ),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();
export const respondToReviewHandoffSchema = z.discriminatedUnion('decision', [
  acceptWorkReviewSchema,
  requestWorkChangesSchema,
]);
export const cancelChangeRequestSchema = z
  .object({
    reason: safeDomainTextSchema(
      z
        .string()
        .trim()
        .min(3, 'A cancellation reason of at least 3 characters is required.')
        .max(2000, 'Cancellation reason must be at most 2,000 characters.'),
      'Cancellation reason',
    ),
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict();

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type VoidTimeEntryInput = z.infer<typeof voidTimeEntrySchema>;
export type StartWorkInput = z.infer<typeof startWorkSchema>;
export type CreateReviewHandoffInput = z.infer<typeof createReviewHandoffSchema>;
export type RespondToReviewHandoffInput = z.infer<typeof respondToReviewHandoffSchema>;
export type CancelChangeRequestInput = z.infer<typeof cancelChangeRequestSchema>;

export const workReviewDecisions = ['ACCEPTED', 'CHANGES_REQUESTED'] as const;
export type WorkReviewDecision = (typeof workReviewDecisions)[number];

export const timeEntryDtoSchema = z.object({
  id: uuidSchema,
  changeRequestId: uuidSchema,
  durationMinutes: z.number().int().min(1).max(1440),
  description: z.string(),
  workDate: calendarDateSchema,
  authorUserId: uuidSchema,
  authorDisplayName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  voidedAt: z.string().datetime().nullable(),
  voidReason: z.string().nullable(),
  voidedByUserId: uuidSchema.nullable(),
  voidedByDisplayName: z.string().nullable(),
});
export type TimeEntryDto = z.infer<typeof timeEntryDtoSchema>;

export const timeEntryListMetaSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().nonnegative(),
  activeDurationMinutes: z.number().int().nonnegative(),
  canCreate: z.boolean(),
  canVoidOwn: z.boolean(),
  canManage: z.boolean(),
});
export type TimeEntryListMeta = z.infer<typeof timeEntryListMetaSchema>;

export const workReviewResponseDtoSchema = z.object({
  id: uuidSchema,
  decision: z.enum(workReviewDecisions),
  note: z.string().nullable(),
  actorDisplayName: z.string(),
  createdAt: z.string().datetime(),
});
export const reviewHandoffDtoSchema = z.object({
  id: uuidSchema,
  changeRequestId: uuidSchema,
  version: z.number().int().positive(),
  workSummary: z.string(),
  releaseNotes: z.string().nullable(),
  actorDisplayName: z.string(),
  createdAt: z.string().datetime(),
  response: workReviewResponseDtoSchema.nullable(),
});
export type WorkReviewResponseDto = z.infer<typeof workReviewResponseDtoSchema>;
export type ReviewHandoffDto = z.infer<typeof reviewHandoffDtoSchema>;

export const workCommandDtoSchema = z.object({
  changeRequestId: uuidSchema,
  status: z.enum(changeRequestStatuses),
  updatedAt: z.string().datetime(),
  handoff: reviewHandoffDtoSchema.nullable(),
});
export type WorkCommandDto = z.infer<typeof workCommandDtoSchema>;

const historyBase = {
  id: z.string(),
  sourceId: uuidSchema,
  eventTime: z.string().datetime(),
  actorDisplayName: z.string(),
};
export const requestHistoryItemSchema = z.discriminatedUnion('kind', [
  z.object({
    ...historyBase,
    kind: z.literal('STATUS_CHANGED'),
    previousStatus: z.enum(changeRequestStatuses).nullable(),
    newStatus: z.enum(changeRequestStatuses),
    note: z.string().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('ESTIMATE_SUBMITTED'),
    version: z.number().int().positive(),
    estimatedHours: normalizedDecimalSchema,
    hourlyRate: normalizedDecimalSchema,
    estimatedCost: normalizedDecimalSchema,
    scopeNotes: z.string(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('ESTIMATE_RESPONDED'),
    version: z.number().int().positive(),
    decision: z.enum(estimateResponseDecisions),
    note: z.string().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('COMMENT'),
    body: z.string(),
    visibility: z.enum(commentVisibilities),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('TIME_CREATED'),
    durationMinutes: z.number().int().positive(),
    description: z.string(),
    workDate: calendarDateSchema,
  }),
  z.object({
    ...historyBase,
    kind: z.literal('TIME_VOIDED'),
    durationMinutes: z.number().int().positive(),
    reason: z.string(),
    originalEntryId: uuidSchema,
  }),
  z.object({
    ...historyBase,
    kind: z.literal('WORK_HANDOFF'),
    version: z.number().int().positive(),
    workSummary: z.string(),
    releaseNotes: z.string().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal('WORK_REVIEW_RESPONSE'),
    handoffVersion: z.number().int().positive(),
    decision: z.enum(workReviewDecisions),
    note: z.string().nullable(),
  }),
]);
export type RequestHistoryItem = z.infer<typeof requestHistoryItemSchema>;

export const requestHistoryMetaSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().nonnegative(),
  canManageWork: z.boolean(),
  canRespondToReview: z.boolean(),
  canCancel: z.boolean(),
  canViewPrivateTime: z.boolean(),
  currentHandoff: reviewHandoffDtoSchema.nullable(),
});
export type RequestHistoryMeta = z.infer<typeof requestHistoryMetaSchema>;

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
