import { describe, expect, it } from 'vitest';
import { parseApiConfig } from './env.js';
const base = { NODE_ENV: 'development', PORT: '4000', DATABASE_URL: 'postgresql://local/test', LOG_LEVEL: 'info', CORS_ORIGIN: 'http://localhost:5173', DEV_AUTH_ENABLED: 'true' };
describe('API environment', () => {
  it('parses valid development configuration', () => expect(parseApiConfig(base).PORT).toBe(4000));
  it('rejects a missing database URL and invalid port without echoing values', () => { expect(() => parseApiConfig({ ...base, DATABASE_URL: undefined, PORT: 'nope' })).toThrow('PORT'); });
  it('rejects development auth in production', () => expect(() => parseApiConfig({ ...base, NODE_ENV: 'production' })).toThrow('prohibited'));
});
