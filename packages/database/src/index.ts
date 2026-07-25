import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'), quiet: true });

function resolvedDatabaseUrl(environment: NodeJS.ProcessEnv): string {
  if (environment.DATABASE_URL) return environment.DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, APPSOLO_DB_NAME } = environment;
  const databaseName = APPSOLO_DB_NAME ?? DB_NAME;
  if (DB_HOST && DB_PORT && databaseName && DB_USER && DB_PASSWORD) {
    return `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${databaseName}`;
  }
  throw new Error('DATABASE_URL is required (or supply all local DB_* connection variables).');
}

export type Database = NodePgDatabase<typeof schema>;
export function createDatabase(databaseUrl = resolvedDatabaseUrl(process.env)): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(pool, { schema }), pool };
}
export { resolvedDatabaseUrl, schema };
