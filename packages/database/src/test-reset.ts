import { createDatabase, resolvedTestDatabaseUrl } from './index.js';
import { seedDatabase } from './seed.js';

const url = new URL(resolvedTestDatabaseUrl(process.env));
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
  url.pathname.slice(1) !== 'appsolo_client_hub_test'
) {
  throw new Error('test:prepare only permits the local appsolo_client_hub_test database.');
}
const { pool } = createDatabase(url.toString());
try {
  await pool.query(
    'DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;',
  );
} finally {
  await pool.end();
}
process.env.DATABASE_URL = url.toString();
await import('./migrate.js');
await seedDatabase(url.toString());
