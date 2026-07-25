import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createDatabase } from './index.js';

const { db, pool } = createDatabase();
try {
  await migrate(db, { migrationsFolder: resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle') });
  console.log('Database migrations applied.');
} finally {
  await pool.end();
}
