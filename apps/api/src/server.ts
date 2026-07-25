import { createDatabase, resolvedTestDatabaseUrl } from '@appsolo/database';
import { createApp } from './app.js';
import { parseApiConfig } from './config/env.js';
const config = parseApiConfig();
const databaseUrl =
  process.env.APPSOLO_USE_TEST_DATABASE === 'true'
    ? resolvedTestDatabaseUrl(process.env)
    : config.DATABASE_URL;
const { db, pool } = createDatabase(databaseUrl);
const server = createApp({ db, config }).listen(config.PORT, () =>
  console.log(`API listening at http://localhost:${config.PORT}`),
);
const shutdown = () =>
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
