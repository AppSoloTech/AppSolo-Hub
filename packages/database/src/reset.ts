import { createDatabase, resolvedDatabaseUrl } from './index.js';
import { seedDatabase } from './seed.js';

const url = new URL(resolvedDatabaseUrl(process.env));
const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
if (
  process.env.NODE_ENV === 'production' ||
  !isLocalHost ||
  url.pathname.slice(1) !== 'appsolo_client_hub_dev'
) {
  throw new Error('db:reset only permits the local appsolo_client_hub_dev database.');
}
const { pool } = createDatabase(url.toString());
try {
  await pool.query(
    'DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;',
  );
} finally {
  await pool.end();
}
await import('./migrate.js');
await seedDatabase();
