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
