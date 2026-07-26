import { describe, expect, it } from 'vitest';
import {
  acceptInvitationSchema,
  createChangeRequestSchema,
  createInvitationSchema,
  developmentSignInSchema,
  updateMembershipSchema,
} from './index.js';

describe('createChangeRequestSchema', () => {
  it('normalizes a valid input and defaults priority', () => {
    expect(
      createChangeRequestSchema.parse({
        title: '  Export CSV ',
        description: '  Please export our dashboard as CSV. ',
      }),
    ).toEqual({
      title: 'Export CSV',
      description: 'Please export our dashboard as CSV.',
      priority: 'NORMAL',
    });
  });
  it('rejects short fields, invalid dates, and unknown fields', () => {
    expect(() =>
      createChangeRequestSchema.parse({
        title: 'No',
        description: 'short',
        requestedCompletionDate: 'tomorrow',
        extra: true,
      }),
    ).toThrow();
  });
});

describe('P002 access contracts', () => {
  it('normalizes sign-in and invitation email addresses and rejects unknown fields', () => {
    expect(developmentSignInSchema.parse({ email: '  ADMIN@CLIENT.TEST ' })).toEqual({
      email: 'admin@client.test',
    });
    expect(
      createInvitationSchema.parse({
        firstName: '  New ',
        lastName: ' Member ',
        email: 'NEW@CLIENT.TEST ',
        role: 'CLIENT_MEMBER',
      }),
    ).toEqual({
      firstName: 'New',
      lastName: 'Member',
      email: 'new@client.test',
      role: 'CLIENT_MEMBER',
    });
    expect(() =>
      createInvitationSchema.parse({
        firstName: 'New',
        lastName: 'Member',
        email: 'new@client.test',
        role: 'CLIENT_MEMBER',
        admin: true,
      }),
    ).toThrow();
  });

  it('requires a high-entropy-sized token and an optimistic membership version', () => {
    expect(() => acceptInvitationSchema.parse({ token: 'short' })).toThrow();
    expect(acceptInvitationSchema.parse({ token: 'a'.repeat(43) })).toEqual({ token: 'a'.repeat(43) });
    expect(() => updateMembershipSchema.parse({ expectedUpdatedAt: '2026-07-26T12:00:00.000Z' })).toThrow();
    expect(
      updateMembershipSchema.parse({
        status: 'SUSPENDED',
        expectedUpdatedAt: '2026-07-26T12:00:00.000Z',
      }),
    ).toMatchObject({ status: 'SUSPENDED' });
  });
});
