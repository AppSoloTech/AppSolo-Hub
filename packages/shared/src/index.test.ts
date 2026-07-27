import { describe, expect, it } from 'vitest';
import {
  acceptInvitationSchema,
  calculateEstimatedCost,
  commentPaginationSchema,
  cancelChangeRequestSchema,
  createCommentSchema,
  createChangeRequestSchema,
  createEstimateSchema,
  createInvitationSchema,
  createReviewHandoffSchema,
  createTimeEntrySchema,
  developmentSignInSchema,
  p005PaginationSchema,
  respondToReviewHandoffSchema,
  respondToEstimateSchema,
  startWorkSchema,
  updateMembershipSchema,
  voidTimeEntrySchema,
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

describe('P004 comment contracts', () => {
  it('trims valid bodies, preserves explicit visibility, and defaults list pagination', () => {
    expect(
      createCommentSchema.parse({
        body: '  A shared clarification follow-up.  ',
        visibility: 'CLIENT_VISIBLE',
      }),
    ).toEqual({
      body: 'A shared clarification follow-up.',
      visibility: 'CLIENT_VISIBLE',
    });
    expect(commentPaginationSchema.parse({})).toEqual({ limit: 50, offset: 0 });
  });

  it('rejects empty, over-limit, unsupported, non-string, unknown, and server-owned fields', () => {
    for (const body of ['', '   ', 'x'.repeat(5001), 'before\u0000after', 42]) {
      expect(() => createCommentSchema.parse({ body, visibility: 'INTERNAL_ONLY' })).toThrow();
    }
    expect(() =>
      createCommentSchema.parse({
        body: 'Valid comment',
        visibility: 'CLIENT_VISIBLE',
        authorUserId: '20000000-0000-4000-8000-000000000001',
      }),
    ).toThrow();
    expect(() => commentPaginationSchema.parse({ limit: 101, internal: true })).toThrow();
  });
});

describe('P003 exact estimate contracts', () => {
  it('normalizes exact decimal inputs and calculates cost with round-half-up arithmetic', () => {
    const input = createEstimateSchema.parse({
      estimatedHours: '0001.5',
      hourlyRate: '0.01',
      scopeNotes: '  Exact scoped implementation work.  ',
    });
    expect(input).toEqual({
      estimatedHours: '1.50',
      hourlyRate: '0.01',
      scopeNotes: 'Exact scoped implementation work.',
    });
    expect(calculateEstimatedCost('1.50', '0.01')).toBe('0.02');
    expect(calculateEstimatedCost('4.50', '125.00')).toBe('562.50');
    expect(calculateEstimatedCost('999999.99', '10000.00')).toBe('9999999900.00');
  });

  it.each(['1e2', '-1', '+1', '1,000', ' 1.00 ', 'NaN', 'Infinity', '1.001'])(
    'rejects non-contract decimal input %s',
    (value) => {
      expect(() =>
        createEstimateSchema.parse({
          estimatedHours: value,
          hourlyRate: '125.00',
          scopeNotes: 'Enough exact scope detail.',
        }),
      ).toThrow();
    },
  );

  it('rejects zero hours and calculated cost overflow', () => {
    expect(() =>
      createEstimateSchema.parse({
        estimatedHours: '0',
        hourlyRate: '1.00',
        scopeNotes: 'Enough exact scope detail.',
      }),
    ).toThrow();
    expect(() => calculateEstimatedCost('999999.99', '9999999999.99')).toThrow(
      'The calculated cost is too large.',
    );
  });

  it('requires reasons for rejection and clarification while allowing an optional approval note', () => {
    const expectedUpdatedAt = '2026-07-26T12:00:00.000Z';
    expect(respondToEstimateSchema.parse({ decision: 'APPROVE', expectedUpdatedAt })).toMatchObject({
      decision: 'APPROVE',
    });
    expect(() =>
      respondToEstimateSchema.parse({ decision: 'REJECT', note: '  ', expectedUpdatedAt }),
    ).toThrow();
    expect(
      respondToEstimateSchema.parse({
        decision: 'REQUEST_CLARIFICATION',
        note: '  Clarify exclusions. ',
        expectedUpdatedAt,
      }),
    ).toMatchObject({ note: 'Clarify exclusions.' });
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

describe('P005 time, work, and review contracts', () => {
  const expectedUpdatedAt = '2026-07-27T12:00:00.000Z';

  it('normalizes strict private-time input and accepts calendar dates only', () => {
    expect(
      createTimeEntrySchema.parse({
        durationMinutes: 90,
        description: '  Implemented the approved workflow.  ',
        workDate: '2026-07-27',
      }),
    ).toEqual({
      durationMinutes: 90,
      description: 'Implemented the approved workflow.',
      workDate: '2026-07-27',
    });
    for (const workDate of ['2026-02-30', '2026-13-01', '07/27/2026']) {
      expect(() =>
        createTimeEntrySchema.parse({
          durationMinutes: 1,
          description: 'Valid description',
          workDate,
        }),
      ).toThrow();
    }
  });

  it('rejects invalid duration, text, unknown, and server-owned time fields', () => {
    for (const durationMinutes of [0, -1, 1.5, 1441]) {
      expect(() =>
        createTimeEntrySchema.parse({
          durationMinutes,
          description: 'Valid description',
          workDate: '2026-07-27',
        }),
      ).toThrow();
    }
    expect(() =>
      createTimeEntrySchema.parse({
        durationMinutes: 30,
        description: 'bad\u0000text',
        workDate: '2026-07-27',
        userId: '20000000-0000-4000-8000-000000000001',
      }),
    ).toThrow();
    expect(p005PaginationSchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(() => p005PaginationSchema.parse({ limit: 101, private: true })).toThrow();
  });

  it('enforces optimistic void, start, handoff, response, and cancellation bodies', () => {
    expect(
      voidTimeEntrySchema.parse({
        reason: '  Wrong work date. ',
        expectedUpdatedAt,
      }),
    ).toMatchObject({ reason: 'Wrong work date.' });
    expect(startWorkSchema.parse({ expectedUpdatedAt })).toEqual({ expectedUpdatedAt });
    expect(
      createReviewHandoffSchema.parse({
        workSummary: '  Completed all approved delivery work. ',
        releaseNotes: '  Ready for client verification. ',
        expectedUpdatedAt,
      }),
    ).toMatchObject({
      workSummary: 'Completed all approved delivery work.',
      releaseNotes: 'Ready for client verification.',
    });
    expect(
      respondToReviewHandoffSchema.parse({
        decision: 'ACCEPT',
        note: '  Verified and accepted. ',
        expectedUpdatedAt,
      }),
    ).toMatchObject({ note: 'Verified and accepted.' });
    expect(() =>
      respondToReviewHandoffSchema.parse({
        decision: 'REQUEST_CHANGES',
        note: '  ',
        expectedUpdatedAt,
      }),
    ).toThrow();
    expect(
      cancelChangeRequestSchema.parse({
        reason: '  Client no longer needs this request. ',
        expectedUpdatedAt,
      }),
    ).toMatchObject({ reason: 'Client no longer needs this request.' });
  });
});
