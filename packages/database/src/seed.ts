import { createDatabase } from './index.js';
import {
  accessAuditEvents,
  attachments,
  changeRequests,
  comments,
  estimateResponses,
  estimates,
  organizationMemberships,
  organizationInvitations,
  organizations,
  projects,
  statusHistory,
  users,
} from './schema.js';

export const seedIds = {
  internalOrganization: '10000000-0000-4000-8000-000000000001',
  clientOrganization: '10000000-0000-4000-8000-000000000002',
  project: '10000000-0000-4000-8000-000000000003',
  otherClientOrganization: '10000000-0000-4000-8000-000000000004',
  otherProject: '10000000-0000-4000-8000-000000000005',
  owner: '20000000-0000-4000-8000-000000000001',
  developer: '20000000-0000-4000-8000-000000000002',
  clientAdmin: '20000000-0000-4000-8000-000000000003',
  clientMember: '20000000-0000-4000-8000-000000000004',
  otherTenantUser: '20000000-0000-4000-8000-000000000005',
  internalOnlyUser: '20000000-0000-4000-8000-000000000006',
  suspendedMember: '20000000-0000-4000-8000-000000000007',
  pendingInvitee: '20000000-0000-4000-8000-000000000008',
  pendingInvitation: '90000000-0000-4000-8000-000000000001',
  requestOne: '30000000-0000-4000-8000-000000000001',
  requestTwo: '30000000-0000-4000-8000-000000000002',
  requestAwaitingApproval: '30000000-0000-4000-8000-000000000003',
  requestApproved: '30000000-0000-4000-8000-000000000004',
  requestRevision: '30000000-0000-4000-8000-000000000005',
  requestClarification: '30000000-0000-4000-8000-000000000006',
  otherTenantRequest: '30000000-0000-4000-8000-000000000007',
  draftEstimate: '50000000-0000-4000-8000-000000000001',
  submittedEstimate: '50000000-0000-4000-8000-000000000002',
  approvedEstimate: '50000000-0000-4000-8000-000000000003',
  supersededEstimate: '50000000-0000-4000-8000-000000000004',
  revisionEstimate: '50000000-0000-4000-8000-000000000005',
  clarificationEstimate: '50000000-0000-4000-8000-000000000006',
  otherTenantEstimate: '50000000-0000-4000-8000-000000000007',
  sharedComment: '60000000-0000-4000-8000-000000000001',
  internalComment: '60000000-0000-4000-8000-000000000002',
  clarificationSharedComment: '60000000-0000-4000-8000-000000000003',
  clarificationInternalComment: '60000000-0000-4000-8000-000000000004',
  suspendedAuthorComment: '60000000-0000-4000-8000-000000000005',
  otherTenantComment: '60000000-0000-4000-8000-000000000006',
} as const;

export async function seedDatabase(databaseUrl?: string): Promise<void> {
  const { db, pool } = createDatabase(databaseUrl);
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values([
          { id: seedIds.owner, email: 'owner@appsolo.test', firstName: 'Avery', lastName: 'Owner' },
          {
            id: seedIds.developer,
            email: 'developer@appsolo.test',
            firstName: 'Devon',
            lastName: 'Developer',
          },
          { id: seedIds.clientAdmin, email: 'admin@client.test', firstName: 'Casey', lastName: 'Admin' },
          { id: seedIds.clientMember, email: 'member@client.test', firstName: 'Morgan', lastName: 'Member' },
          {
            id: seedIds.otherTenantUser,
            email: 'other@other-client.test',
            firstName: 'Taylor',
            lastName: 'Other',
          },
          {
            id: seedIds.internalOnlyUser,
            email: 'internal-only@appsolo.test',
            firstName: 'Riley',
            lastName: 'Internal',
          },
          {
            id: seedIds.suspendedMember,
            email: 'suspended-member@client.test',
            firstName: 'Sam',
            lastName: 'Suspended',
          },
          {
            id: seedIds.pendingInvitee,
            email: 'pending-invitee@client.test',
            firstName: 'Parker',
            lastName: 'Pending',
            status: 'INVITED',
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(organizations)
        .values([
          { id: seedIds.internalOrganization, name: 'AppSolo', slug: 'appsolo', type: 'INTERNAL' },
          {
            id: seedIds.clientOrganization,
            name: 'Northstar Demo Co.',
            slug: 'northstar-demo',
            type: 'CLIENT',
          },
          { id: seedIds.otherClientOrganization, name: 'Acme Demo Co.', slug: 'acme-demo', type: 'CLIENT' },
        ])
        .onConflictDoNothing();
      await tx
        .insert(organizationMemberships)
        .values([
          {
            id: '40000000-0000-4000-8000-000000000001',
            userId: seedIds.owner,
            organizationId: seedIds.internalOrganization,
            role: 'OWNER',
          },
          {
            id: '40000000-0000-4000-8000-000000000002',
            userId: seedIds.developer,
            organizationId: seedIds.internalOrganization,
            role: 'DEVELOPER',
          },
          {
            id: '40000000-0000-4000-8000-000000000003',
            userId: seedIds.owner,
            organizationId: seedIds.clientOrganization,
            role: 'OWNER',
          },
          {
            id: '40000000-0000-4000-8000-000000000004',
            userId: seedIds.developer,
            organizationId: seedIds.clientOrganization,
            role: 'DEVELOPER',
          },
          {
            id: '40000000-0000-4000-8000-000000000005',
            userId: seedIds.clientAdmin,
            organizationId: seedIds.clientOrganization,
            role: 'CLIENT_ADMIN',
          },
          {
            id: '40000000-0000-4000-8000-000000000006',
            userId: seedIds.clientMember,
            organizationId: seedIds.clientOrganization,
            role: 'CLIENT_MEMBER',
          },
          {
            id: '40000000-0000-4000-8000-000000000007',
            userId: seedIds.otherTenantUser,
            organizationId: seedIds.otherClientOrganization,
            role: 'CLIENT_MEMBER',
          },
          {
            id: '40000000-0000-4000-8000-000000000008',
            userId: seedIds.internalOnlyUser,
            organizationId: seedIds.internalOrganization,
            role: 'DEVELOPER',
          },
          {
            id: '40000000-0000-4000-8000-000000000009',
            userId: seedIds.suspendedMember,
            organizationId: seedIds.clientOrganization,
            role: 'CLIENT_MEMBER',
            status: 'SUSPENDED',
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(organizationInvitations)
        .values({
          id: seedIds.pendingInvitation,
          organizationId: seedIds.clientOrganization,
          invitedUserId: seedIds.pendingInvitee,
          email: 'pending-invitee@client.test',
          proposedRole: 'CLIENT_MEMBER',
          invitedByUserId: seedIds.owner,
          authorizedByRole: 'OWNER',
          tokenHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          expiresAt: new Date('2036-07-26T12:00:00.000Z'),
        })
        .onConflictDoNothing();
      await tx
        .insert(accessAuditEvents)
        .values({
          id: 'a0000000-0000-4000-8000-000000000001',
          organizationId: seedIds.clientOrganization,
          eventType: 'INVITATION_CREATED',
          actorUserId: seedIds.owner,
          subjectUserId: seedIds.pendingInvitee,
          invitationId: seedIds.pendingInvitation,
          newRole: 'CLIENT_MEMBER',
        })
        .onConflictDoNothing();
      await tx
        .insert(projects)
        .values([
          {
            id: seedIds.project,
            organizationId: seedIds.clientOrganization,
            name: 'Northstar client portal',
            slug: 'northstar-client-portal',
            description: 'Clearly fake seeded client project.',
          },
          {
            id: seedIds.otherProject,
            organizationId: seedIds.otherClientOrganization,
            name: 'Acme client portal',
            slug: 'acme-client-portal',
            description: 'Second fake tenant project for isolation tests.',
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(changeRequests)
        .values([
          {
            id: seedIds.requestOne,
            projectId: seedIds.project,
            submittedByUserId: seedIds.clientAdmin,
            title: 'Export dashboard data',
            description: 'Allow client administrators to export dashboard data as a CSV file.',
            priority: 'HIGH',
            status: 'SUBMITTED',
            requestedCompletionDate: '2026-08-15',
          },
          {
            id: seedIds.requestTwo,
            projectId: seedIds.project,
            submittedByUserId: seedIds.clientMember,
            title: 'Improve account search',
            description: 'Make account search easier to use when there are many customer records.',
            priority: 'NORMAL',
            status: 'AWAITING_ESTIMATE',
          },
          {
            id: seedIds.requestAwaitingApproval,
            projectId: seedIds.project,
            submittedByUserId: seedIds.clientAdmin,
            title: 'Add accessible report filters',
            description: 'Add keyboard-accessible saved filters to the monthly reporting view.',
            priority: 'NORMAL',
            status: 'AWAITING_APPROVAL',
          },
          {
            id: seedIds.requestApproved,
            projectId: seedIds.project,
            submittedByUserId: seedIds.clientAdmin,
            title: 'Improve export progress feedback',
            description: 'Show clear progress while a large dashboard export is being prepared.',
            priority: 'LOW',
            status: 'APPROVED',
          },
          {
            id: seedIds.requestRevision,
            projectId: seedIds.project,
            submittedByUserId: seedIds.clientMember,
            title: 'Revise search result grouping',
            description: 'Group account search results by customer region and account status.',
            priority: 'HIGH',
            status: 'AWAITING_APPROVAL',
          },
          {
            id: seedIds.requestClarification,
            projectId: seedIds.project,
            submittedByUserId: seedIds.clientAdmin,
            title: 'Clarify dashboard alert rules',
            description: 'Define which dashboard thresholds should create a visible alert.',
            priority: 'NORMAL',
            status: 'NEEDS_CLARIFICATION',
          },
          {
            id: seedIds.otherTenantRequest,
            projectId: seedIds.otherProject,
            submittedByUserId: seedIds.otherTenantUser,
            title: 'Other tenant estimate fixture',
            description: 'This fake request proves estimate history remains isolated by tenant.',
            priority: 'NORMAL',
            status: 'AWAITING_ESTIMATE',
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(estimates)
        .values([
          {
            id: seedIds.draftEstimate,
            changeRequestId: seedIds.requestTwo,
            createdByUserId: seedIds.developer,
            estimatedHours: '4.50',
            hourlyRate: '125.00',
            estimatedCost: '562.50',
            scopeNotes: 'Fake estimate retained as a decimal-string seed fixture.',
            status: 'DRAFT',
            version: 1,
          },
          {
            id: seedIds.submittedEstimate,
            changeRequestId: seedIds.requestAwaitingApproval,
            createdByUserId: seedIds.developer,
            estimatedHours: '3.25',
            hourlyRate: '140.00',
            estimatedCost: '455.00',
            scopeNotes: 'Implement and verify accessible saved report filters.',
            status: 'SUBMITTED',
            version: 1,
            submittedAt: new Date('2026-07-26T14:00:00.000Z'),
          },
          {
            id: seedIds.approvedEstimate,
            changeRequestId: seedIds.requestApproved,
            createdByUserId: seedIds.owner,
            estimatedHours: '2.00',
            hourlyRate: '150.00',
            estimatedCost: '300.00',
            scopeNotes: 'Add progress feedback and verify it with large fake exports.',
            status: 'APPROVED',
            version: 1,
            submittedAt: new Date('2026-07-25T14:00:00.000Z'),
          },
          {
            id: seedIds.supersededEstimate,
            changeRequestId: seedIds.requestRevision,
            createdByUserId: seedIds.developer,
            estimatedHours: '5.00',
            hourlyRate: '125.00',
            estimatedCost: '625.00',
            scopeNotes: 'Initial grouping proposal retained as immutable rejected history.',
            status: 'SUPERSEDED',
            version: 1,
            submittedAt: new Date('2026-07-24T14:00:00.000Z'),
          },
          {
            id: seedIds.revisionEstimate,
            changeRequestId: seedIds.requestRevision,
            createdByUserId: seedIds.developer,
            estimatedHours: '4.75',
            hourlyRate: '125.00',
            estimatedCost: '593.75',
            scopeNotes: 'Revised grouping scope excluding archived account categories.',
            status: 'SUBMITTED',
            version: 2,
            submittedAt: new Date('2026-07-26T15:00:00.000Z'),
          },
          {
            id: seedIds.clarificationEstimate,
            changeRequestId: seedIds.requestClarification,
            createdByUserId: seedIds.owner,
            estimatedHours: '1.25',
            hourlyRate: '150.00',
            estimatedCost: '187.50',
            scopeNotes: 'Configure dashboard alert thresholds after client confirmation.',
            status: 'NEEDS_CLARIFICATION',
            version: 1,
            submittedAt: new Date('2026-07-26T13:00:00.000Z'),
          },
          {
            id: seedIds.otherTenantEstimate,
            changeRequestId: seedIds.otherTenantRequest,
            createdByUserId: seedIds.otherTenantUser,
            estimatedHours: '2.50',
            hourlyRate: '90.00',
            estimatedCost: '225.00',
            scopeNotes: 'Cross-tenant draft that Northstar users must never discover.',
            status: 'DRAFT',
            version: 1,
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(estimateResponses)
        .values([
          {
            id: '51000000-0000-4000-8000-000000000001',
            estimateId: seedIds.approvedEstimate,
            decision: 'APPROVED',
            respondingUserId: seedIds.clientAdmin,
            note: 'Approved for the next delivery window.',
            createdAt: new Date('2026-07-25T16:00:00.000Z'),
          },
          {
            id: '51000000-0000-4000-8000-000000000002',
            estimateId: seedIds.supersededEstimate,
            decision: 'REJECTED',
            respondingUserId: seedIds.clientAdmin,
            note: 'Please exclude archived account categories.',
            createdAt: new Date('2026-07-24T16:00:00.000Z'),
          },
          {
            id: '51000000-0000-4000-8000-000000000003',
            estimateId: seedIds.clarificationEstimate,
            decision: 'CLARIFICATION_REQUESTED',
            respondingUserId: seedIds.clientAdmin,
            note: 'Which thresholds are included in the estimate?',
            createdAt: new Date('2026-07-26T13:30:00.000Z'),
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(comments)
        .values([
          {
            id: seedIds.sharedComment,
            changeRequestId: seedIds.requestOne,
            authorUserId: seedIds.clientAdmin,
            body: 'This will help our monthly reporting.',
            visibility: 'CLIENT_VISIBLE',
            createdAt: new Date('2026-07-26T10:00:00.000Z'),
            updatedAt: new Date('2026-07-26T10:00:00.000Z'),
          },
          {
            id: seedIds.internalComment,
            changeRequestId: seedIds.requestOne,
            authorUserId: seedIds.developer,
            body: 'Internal implementation note for the future estimate.',
            visibility: 'INTERNAL_ONLY',
            createdAt: new Date('2026-07-26T10:00:00.000Z'),
            updatedAt: new Date('2026-07-26T10:00:00.000Z'),
          },
          {
            id: seedIds.clarificationSharedComment,
            changeRequestId: seedIds.requestClarification,
            authorUserId: seedIds.clientAdmin,
            body: 'The warning threshold should apply to monthly totals.',
            visibility: 'CLIENT_VISIBLE',
            createdAt: new Date('2026-07-26T14:00:00.000Z'),
            updatedAt: new Date('2026-07-26T14:00:00.000Z'),
          },
          {
            id: seedIds.clarificationInternalComment,
            changeRequestId: seedIds.requestClarification,
            authorUserId: seedIds.owner,
            body: 'Internal only: confirm whether daily aggregation affects the estimate.',
            visibility: 'INTERNAL_ONLY',
            createdAt: new Date('2026-07-26T14:01:00.000Z'),
            updatedAt: new Date('2026-07-26T14:01:00.000Z'),
          },
          {
            id: seedIds.suspendedAuthorComment,
            changeRequestId: seedIds.requestClarification,
            authorUserId: seedIds.suspendedMember,
            body: 'Historical shared context remains attributed after membership suspension.',
            visibility: 'CLIENT_VISIBLE',
            createdAt: new Date('2026-07-26T14:02:00.000Z'),
            updatedAt: new Date('2026-07-26T14:02:00.000Z'),
          },
          {
            id: seedIds.otherTenantComment,
            changeRequestId: seedIds.otherTenantRequest,
            authorUserId: seedIds.otherTenantUser,
            body: 'This other-tenant comment must remain isolated.',
            visibility: 'CLIENT_VISIBLE',
            createdAt: new Date('2026-07-26T14:03:00.000Z'),
            updatedAt: new Date('2026-07-26T14:03:00.000Z'),
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(statusHistory)
        .values([
          {
            id: '70000000-0000-4000-8000-000000000001',
            changeRequestId: seedIds.requestOne,
            changedByUserId: seedIds.clientAdmin,
            newStatus: 'SUBMITTED',
            note: 'Initial seeded request.',
          },
          {
            id: '70000000-0000-4000-8000-000000000002',
            changeRequestId: seedIds.requestTwo,
            changedByUserId: seedIds.clientMember,
            newStatus: 'SUBMITTED',
          },
          {
            id: '70000000-0000-4000-8000-000000000003',
            changeRequestId: seedIds.requestTwo,
            changedByUserId: seedIds.developer,
            previousStatus: 'SUBMITTED',
            newStatus: 'AWAITING_ESTIMATE',
          },
          {
            id: '70000000-0000-4000-8000-000000000004',
            changeRequestId: seedIds.requestAwaitingApproval,
            changedByUserId: seedIds.developer,
            previousStatus: 'AWAITING_ESTIMATE',
            newStatus: 'AWAITING_APPROVAL',
          },
          {
            id: '70000000-0000-4000-8000-000000000005',
            changeRequestId: seedIds.requestApproved,
            changedByUserId: seedIds.clientAdmin,
            previousStatus: 'AWAITING_APPROVAL',
            newStatus: 'APPROVED',
          },
          {
            id: '70000000-0000-4000-8000-000000000006',
            changeRequestId: seedIds.requestRevision,
            changedByUserId: seedIds.clientAdmin,
            previousStatus: 'AWAITING_APPROVAL',
            newStatus: 'REJECTED',
          },
          {
            id: '70000000-0000-4000-8000-000000000007',
            changeRequestId: seedIds.requestRevision,
            changedByUserId: seedIds.developer,
            previousStatus: 'REJECTED',
            newStatus: 'AWAITING_APPROVAL',
          },
          {
            id: '70000000-0000-4000-8000-000000000008',
            changeRequestId: seedIds.requestClarification,
            changedByUserId: seedIds.clientAdmin,
            previousStatus: 'AWAITING_APPROVAL',
            newStatus: 'NEEDS_CLARIFICATION',
          },
          {
            id: '70000000-0000-4000-8000-000000000009',
            changeRequestId: seedIds.otherTenantRequest,
            changedByUserId: seedIds.otherTenantUser,
            previousStatus: 'SUBMITTED',
            newStatus: 'AWAITING_ESTIMATE',
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(attachments)
        .values({
          id: '80000000-0000-4000-8000-000000000001',
          changeRequestId: seedIds.requestOne,
          uploadedByUserId: seedIds.clientAdmin,
          originalFilename: 'placeholder.txt',
          storageKey: 'seed/no-upload-placeholder.txt',
          mimeType: 'text/plain',
          sizeBytes: 0,
        })
        .onConflictDoNothing();
    });
    console.log('Seed data is present.');
  } finally {
    await pool.end();
  }
}
if (process.argv[1]?.endsWith('seed.ts')) await seedDatabase();
