import { describe, expect, it } from 'vitest';
import { resolvedDatabaseUrl } from './index.js';
describe('database environment resolution', () => {
  it('requires a URL or complete local connection variables', () => { expect(() => resolvedDatabaseUrl({})).toThrow('DATABASE_URL'); });
  it('accepts an explicit URL', () => { expect(resolvedDatabaseUrl({ DATABASE_URL: 'postgresql://local/test' })).toBe('postgresql://local/test'); });
});
