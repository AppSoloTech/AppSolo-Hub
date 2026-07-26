import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
export const userStatus = pgEnum('user_status', ['INVITED', 'ACTIVE', 'SUSPENDED']);
export const organizationType = pgEnum('organization_type', ['INTERNAL', 'CLIENT']);
export const organizationStatus = pgEnum('organization_status', ['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export const organizationRole = pgEnum('organization_role', [
  'OWNER',
  'ADMIN',
  'DEVELOPER',
  'CLIENT_ADMIN',
  'CLIENT_MEMBER',
]);
export const membershipStatus = pgEnum('membership_status', ['ACTIVE', 'SUSPENDED']);
export const invitationStatus = pgEnum('invitation_status', ['PENDING', 'ACCEPTED', 'REVOKED']);
export const accessEventType = pgEnum('access_event_type', [
  'INVITATION_CREATED',
  'INVITATION_RESENT',
  'INVITATION_REVOKED',
  'INVITATION_ACCEPTED',
  'MEMBERSHIP_ROLE_CHANGED',
  'MEMBERSHIP_SUSPENDED',
  'MEMBERSHIP_REACTIVATED',
]);
export const projectStatus = pgEnum('project_status', ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']);
export const changeRequestPriority = pgEnum('change_request_priority', ['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const changeRequestStatus = pgEnum('change_request_status', [
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
]);
export const estimateStatus = pgEnum('estimate_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'NEEDS_CLARIFICATION',
  'SUPERSEDED',
]);
export const estimateResponseDecision = pgEnum('estimate_response_decision', [
  'APPROVED',
  'REJECTED',
  'CLARIFICATION_REQUESTED',
]);
export const commentVisibility = pgEnum('comment_visibility', ['CLIENT_VISIBLE', 'INTERNAL_ONLY']);
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 320 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    status: userStatus('status').notNull().default('ACTIVE'),
    ...timestamps,
  },
  (t) => [
    unique('users_email_unique').on(t.email),
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
    uniqueIndex('users_email_lower_unique').on(sql`lower(${t.email})`),
  ],
);
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    type: organizationType('type').notNull(),
    status: organizationStatus('status').notNull().default('ACTIVE'),
    ...timestamps,
  },
  (t) => [unique('organizations_slug_unique').on(t.slug)],
);
export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    role: organizationRole('role').notNull(),
    status: membershipStatus('status').notNull().default('ACTIVE'),
    ...timestamps,
  },
  (t) => [
    unique('memberships_user_org_unique').on(t.userId, t.organizationId),
    index('memberships_organization_role_idx').on(t.organizationId, t.role),
    index('memberships_organization_status_role_idx').on(t.organizationId, t.status, t.role),
    index('memberships_user_idx').on(t.userId),
  ],
);
export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    invitedUserId: uuid('invited_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    email: varchar('email', { length: 320 }).notNull(),
    proposedRole: organizationRole('proposed_role').notNull(),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    authorizedByRole: organizationRole('authorized_by_role').notNull(),
    status: invitationStatus('status').notNull().default('PENDING'),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    resentAt: timestamp('resent_at', { withTimezone: true }),
    resendCount: integer('resend_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check('organization_invitations_email_lowercase', sql`${t.email} = lower(${t.email})`),
    check('organization_invitations_resend_count_nonnegative', sql`${t.resendCount} >= 0`),
    unique('organization_invitations_token_hash_unique').on(t.tokenHash),
    uniqueIndex('organization_invitations_pending_email_unique')
      .on(t.organizationId, t.email)
      .where(sql`${t.status} = 'PENDING'`),
    index('organization_invitations_org_created_idx').on(t.organizationId, t.createdAt.desc(), t.id),
    index('organization_invitations_user_idx').on(t.invitedUserId),
  ],
);
export const accessAuditEvents = pgTable(
  'access_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    eventType: accessEventType('event_type').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    subjectUserId: uuid('subject_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    invitationId: uuid('invitation_id').references(() => organizationInvitations.id, {
      onDelete: 'restrict',
    }),
    membershipId: uuid('membership_id').references(() => organizationMemberships.id, {
      onDelete: 'restrict',
    }),
    previousRole: organizationRole('previous_role'),
    newRole: organizationRole('new_role'),
    previousStatus: membershipStatus('previous_status'),
    newStatus: membershipStatus('new_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('access_audit_events_org_created_idx').on(t.organizationId, t.createdAt.desc(), t.id.desc()),
    index('access_audit_events_subject_created_idx').on(t.subjectUserId, t.createdAt.desc()),
  ],
);
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description'),
    status: projectStatus('status').notNull().default('ACTIVE'),
    ...timestamps,
  },
  (t) => [
    unique('projects_organization_slug_unique').on(t.organizationId, t.slug),
    index('projects_organization_status_idx').on(t.organizationId, t.status),
  ],
);
export const changeRequests = pgTable(
  'change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
    submittedByUserId: uuid('submitted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description').notNull(),
    priority: changeRequestPriority('priority').notNull().default('NORMAL'),
    status: changeRequestStatus('status').notNull().default('SUBMITTED'),
    requestedCompletionDate: date('requested_completion_date'),
    ...timestamps,
  },
  (t) => [
    check('change_requests_title_length', sql`char_length(btrim(${t.title})) >= 3`),
    check('change_requests_description_length', sql`char_length(btrim(${t.description})) >= 10`),
    index('change_requests_project_created_idx').on(t.projectId, t.createdAt.desc()),
    index('change_requests_project_status_idx').on(t.projectId, t.status),
    index('change_requests_submitter_idx').on(t.submittedByUserId),
  ],
);
export const estimates = pgTable(
  'estimates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    changeRequestId: uuid('change_request_id')
      .notNull()
      .references(() => changeRequests.id, { onDelete: 'restrict' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    estimatedHours: numeric('estimated_hours', { precision: 8, scale: 2 }).notNull(),
    hourlyRate: numeric('hourly_rate', { precision: 12, scale: 2 }).notNull(),
    estimatedCost: numeric('estimated_cost', { precision: 12, scale: 2 }).notNull(),
    scopeNotes: text('scope_notes').notNull(),
    status: estimateStatus('status').notNull(),
    version: integer('version').notNull().default(1),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check('estimates_hours_positive', sql`${t.estimatedHours} > 0`),
    check('estimates_rate_nonnegative', sql`${t.hourlyRate} >= 0`),
    check('estimates_cost_nonnegative', sql`${t.estimatedCost} >= 0`),
    check('estimates_version_positive', sql`${t.version} > 0`),
    check('estimates_scope_notes_length', sql`char_length(btrim(${t.scopeNotes})) between 10 and 10000`),
    check(
      'estimates_cost_matches_terms',
      sql`${t.estimatedCost} = round(${t.estimatedHours} * ${t.hourlyRate}, 2)`,
    ),
    unique('estimates_request_version_unique').on(t.changeRequestId, t.version),
    uniqueIndex('estimates_one_draft_per_request_unique')
      .on(t.changeRequestId)
      .where(sql`${t.status} = 'DRAFT'`),
    uniqueIndex('estimates_one_submitted_per_request_unique')
      .on(t.changeRequestId)
      .where(sql`${t.status} = 'SUBMITTED'`),
    index('estimates_request_created_idx').on(t.changeRequestId, t.createdAt.desc()),
    index('estimates_request_status_idx').on(t.changeRequestId, t.status),
  ],
);
export const estimateResponses = pgTable(
  'estimate_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    estimateId: uuid('estimate_id')
      .notNull()
      .references(() => estimates.id, { onDelete: 'restrict' }),
    decision: estimateResponseDecision('decision').notNull(),
    respondingUserId: uuid('responding_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('estimate_responses_estimate_unique').on(t.estimateId),
    check('estimate_responses_note_length', sql`${t.note} is null or char_length(${t.note}) <= 2000`),
    check(
      'estimate_responses_reason_required',
      sql`${t.decision} = 'APPROVED' or char_length(btrim(${t.note})) between 3 and 2000`,
    ),
    check(
      'estimate_responses_reason_present',
      sql`${t.decision} = 'APPROVED' or (${t.note} is not null and char_length(btrim(${t.note})) between 3 and 2000)`,
    ),
    index('estimate_responses_user_created_idx').on(t.respondingUserId, t.createdAt.desc()),
  ],
);
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    changeRequestId: uuid('change_request_id')
      .notNull()
      .references(() => changeRequests.id, { onDelete: 'restrict' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    visibility: commentVisibility('visibility').notNull(),
    ...timestamps,
  },
  (t) => [
    index('comments_request_created_idx').on(t.changeRequestId, t.createdAt),
    index('comments_request_visibility_created_idx').on(t.changeRequestId, t.visibility, t.createdAt),
  ],
);
export const statusHistory = pgTable(
  'status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    changeRequestId: uuid('change_request_id')
      .notNull()
      .references(() => changeRequests.id, { onDelete: 'restrict' }),
    changedByUserId: uuid('changed_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    previousStatus: changeRequestStatus('previous_status'),
    newStatus: changeRequestStatus('new_status').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('status_history_request_created_idx').on(t.changeRequestId, t.createdAt),
    index('status_history_user_created_idx').on(t.changedByUserId, t.createdAt.desc()),
  ],
);
export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    changeRequestId: uuid('change_request_id')
      .notNull()
      .references(() => changeRequests.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    durationMinutes: integer('duration_minutes').notNull(),
    description: text('description').notNull(),
    workDate: date('work_date').notNull(),
    ...timestamps,
  },
  (t) => [
    check('time_entries_duration_positive', sql`${t.durationMinutes} > 0`),
    index('time_entries_request_date_idx').on(t.changeRequestId, t.workDate.desc()),
    index('time_entries_user_date_idx').on(t.userId, t.workDate.desc()),
  ],
);
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    changeRequestId: uuid('change_request_id')
      .notNull()
      .references(() => changeRequests.id, { onDelete: 'restrict' }),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    storageKey: varchar('storage_key', { length: 1024 }).notNull(),
    mimeType: varchar('mime_type', { length: 255 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('attachments_storage_key_unique').on(t.storageKey),
    check('attachments_size_nonnegative', sql`${t.sizeBytes} >= 0`),
    index('attachments_request_created_idx').on(t.changeRequestId, t.createdAt),
  ],
);
