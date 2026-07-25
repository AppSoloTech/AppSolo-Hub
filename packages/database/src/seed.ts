import { createDatabase } from './index.js';
import {
  attachments,
  changeRequests,
  comments,
  estimates,
  organizationMemberships,
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
  requestOne: '30000000-0000-4000-8000-000000000001',
  requestTwo: '30000000-0000-4000-8000-000000000002',
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
        ])
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
        ])
        .onConflictDoNothing();
      await tx
        .insert(estimates)
        .values({
          id: '50000000-0000-4000-8000-000000000001',
          changeRequestId: seedIds.requestTwo,
          createdByUserId: seedIds.developer,
          estimatedHours: '4.50',
          hourlyRate: '125.00',
          estimatedCost: '562.50',
          scopeNotes: 'Fake estimate retained as a decimal-string seed fixture.',
          status: 'DRAFT',
        })
        .onConflictDoNothing();
      await tx
        .insert(comments)
        .values([
          {
            id: '60000000-0000-4000-8000-000000000001',
            changeRequestId: seedIds.requestOne,
            authorUserId: seedIds.clientAdmin,
            body: 'This will help our monthly reporting.',
            visibility: 'CLIENT_VISIBLE',
          },
          {
            id: '60000000-0000-4000-8000-000000000002',
            changeRequestId: seedIds.requestOne,
            authorUserId: seedIds.developer,
            body: 'Internal implementation note for the future estimate.',
            visibility: 'INTERNAL_ONLY',
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
