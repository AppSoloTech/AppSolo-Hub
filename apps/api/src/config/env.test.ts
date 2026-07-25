import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadApiEnvironment, parseApiConfig } from './env.js';
const base = {
  NODE_ENV: 'development',
  PORT: '4000',
  DATABASE_URL: 'postgresql://local/test',
  LOG_LEVEL: 'info',
  CORS_ORIGIN: 'http://localhost:5173',
  DEV_AUTH_ENABLED: 'true',
};
describe('API environment', () => {
  it('parses valid development configuration', () => expect(parseApiConfig(base).PORT).toBe(4000));
  it('rejects a missing database URL without echoing values', () => {
    const secret = 'postgresql://user:secret@localhost/private';
    expect(() => parseApiConfig({ ...base, DATABASE_URL: undefined, DB_PASSWORD: secret })).toThrow(
      'DATABASE_URL',
    );
    expect(() => parseApiConfig({ ...base, DATABASE_URL: undefined, DB_PASSWORD: secret })).not.toThrow(
      secret,
    );
  });
  it('rejects an invalid port', () =>
    expect(() => parseApiConfig({ ...base, PORT: 'nope' })).toThrow('PORT'));
  it('rejects development auth in production', () =>
    expect(() => parseApiConfig({ ...base, NODE_ENV: 'production' })).toThrow('prohibited'));
  it('parses the test-database switch as a validated boolean', () => {
    expect(parseApiConfig({ ...base, APPSOLO_USE_TEST_DATABASE: 'true' }).APPSOLO_USE_TEST_DATABASE).toBe(
      true,
    );
    expect(() => parseApiConfig({ ...base, APPSOLO_USE_TEST_DATABASE: 'yes' })).toThrow(
      'APPSOLO_USE_TEST_DATABASE',
    );
  });
  it('keeps exported values ahead of root and API environment files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'appsolo-api-env-'));
    const rootPath = join(directory, 'root.env');
    const apiPath = join(directory, 'api.env');
    try {
      await writeFile(rootPath, 'APPSOLO_USE_TEST_DATABASE=false\nPORT=4001\n');
      await writeFile(apiPath, 'APPSOLO_USE_TEST_DATABASE=false\nPORT=4002\n');
      const environment = {
        APPSOLO_USE_TEST_DATABASE: 'true',
        PORT: '4000',
      };
      loadApiEnvironment(environment, { root: rootPath, api: apiPath });
      expect(environment).toMatchObject({
        APPSOLO_USE_TEST_DATABASE: 'true',
        PORT: '4000',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
