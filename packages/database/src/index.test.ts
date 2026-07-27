import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase, resolvedDatabaseUrl, resolvedTestDatabaseUrl } from './index.js';
import { seedIds } from './seed.js';
describe('database environment resolution', () => {
  it('requires a URL or complete local connection variables', () => {
    expect(() => resolvedDatabaseUrl({})).toThrow('DATABASE_URL');
  });
  it('accepts an explicit URL', () => {
    expect(resolvedDatabaseUrl({ DATABASE_URL: 'postgresql://local/test' })).toBe('postgresql://local/test');
  });
  it('uses only the explicit test URL for a documented DATABASE_URL configuration', () => {
    expect(
      resolvedTestDatabaseUrl({
        DATABASE_URL: 'postgresql://local/appsolo_client_hub_dev',
        TEST_DATABASE_URL: 'postgresql://local/appsolo_client_hub_test',
      }),
    ).toBe('postgresql://local/appsolo_client_hub_test');
  });
});

describe('P003 estimate database invariants', () => {
  const { pool } = createDatabase(resolvedTestDatabaseUrl(process.env));

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a stored cost that does not equal the rounded exact product', async () => {
    await expect(
      pool.query("UPDATE estimates SET estimated_cost = '1.00' WHERE id = $1", [seedIds.draftEstimate]),
    ).rejects.toMatchObject({ code: '23514' });
    const result = await pool.query<{ estimated_cost: string }>(
      'SELECT estimated_cost FROM estimates WHERE id = $1',
      [seedIds.draftEstimate],
    );
    expect(result.rows[0]?.estimated_cost).toBe('562.50');
  });

  it('rejects a rejection or clarification response without a reason', async () => {
    await expect(
      pool.query(
        "INSERT INTO estimate_responses (estimate_id, decision, responding_user_id, note) VALUES ($1, 'REJECTED', $2, NULL)",
        [seedIds.draftEstimate, seedIds.clientAdmin],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('P004 comment database invariants', () => {
  const { pool } = createDatabase(resolvedTestDatabaseUrl(process.env));

  afterAll(async () => {
    await pool.end();
  });

  it.each(['', '   ', 'x'.repeat(5001)])('rejects invalid stored comment body length', async (body) => {
    await expect(
      pool.query('UPDATE comments SET body = $1 WHERE id = $2', [body, seedIds.sharedComment]),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('P005 time and review database invariants', () => {
  const { pool } = createDatabase(resolvedTestDatabaseUrl(process.env));

  afterAll(async () => {
    await pool.end();
  });

  it('enforces bounded time, valid descriptions, and all-or-none void metadata', async () => {
    await expect(
      pool.query('UPDATE time_entries SET duration_minutes = 1441 WHERE id = $1', [seedIds.activeTimeEntry]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query("UPDATE time_entries SET description = '  ' WHERE id = $1", [seedIds.activeTimeEntry]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query("UPDATE time_entries SET void_reason = 'partial' WHERE id = $1", [seedIds.activeTimeEntry]),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('enforces request-local handoff versions and one immutable response row', async () => {
    await expect(
      pool.query(
        `INSERT INTO work_review_handoffs
          (change_request_id, version, created_by_user_id, work_summary)
         VALUES ($1, 1, $2, 'A duplicate request-local handoff version.')`,
        [seedIds.requestReadyForReview, seedIds.owner],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      pool.query(
        `INSERT INTO work_review_responses
          (handoff_id, decision, responding_user_id, note)
         VALUES ($1, 'ACCEPTED', $2, 'Duplicate response.')`,
        [seedIds.completedHandoffOne, seedIds.clientAdmin],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('enforces status, handoff, and review-response text invariants', async () => {
    await expect(
      pool.query("UPDATE status_history SET note = ' ' WHERE change_request_id = $1", [
        seedIds.requestReadyForReview,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query("UPDATE work_review_handoffs SET work_summary = 'short' WHERE id = $1", [
        seedIds.readyHandoff,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(
        `INSERT INTO work_review_responses
          (handoff_id, decision, responding_user_id, note)
         VALUES ($1, 'CHANGES_REQUESTED', $2, NULL)`,
        [seedIds.readyHandoff, seedIds.clientAdmin],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it.each([
    [seedIds.requestInProgress, ['SUBMITTED', 'IN_PROGRESS']],
    [seedIds.requestReadyForReview, ['SUBMITTED', 'IN_PROGRESS', 'READY_FOR_REVIEW']],
    [
      seedIds.requestCompleted,
      ['SUBMITTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED'],
    ],
    [seedIds.requestCancelled, ['SUBMITTED', 'CANCELLED']],
  ])('seeds a durable lifecycle chronology for %s', async (changeRequestId, expectedStatuses) => {
    const result = await pool.query<{ new_status: string }>(
      `SELECT new_status
         FROM status_history
        WHERE change_request_id = $1
        ORDER BY created_at, id`,
      [changeRequestId],
    );
    expect(result.rows.map((row) => row.new_status)).toEqual(expectedStatuses);
  });
});
