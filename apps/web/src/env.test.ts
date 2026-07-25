import { describe, expect, it } from 'vitest';
import { parseWebEnvironment } from './env.js';
describe('web environment', () => {
  it('rejects missing API base URL', () => expect(() => parseWebEnvironment({})).toThrow());
  it('rejects an invalid API base URL', () =>
    expect(() => parseWebEnvironment({ VITE_API_BASE_URL: 'not-a-url' })).toThrow());
  it('parses a valid browser configuration', () =>
    expect(parseWebEnvironment({ VITE_API_BASE_URL: 'http://localhost:4000/api/v1' }).VITE_APP_NAME).toBe(
      'AppSolo Client Hub',
    ));
});
