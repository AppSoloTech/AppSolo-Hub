import { describe, expect, it } from 'vitest';
import { resolvedDatabaseUrl, resolvedTestDatabaseUrl } from './index.js';
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
