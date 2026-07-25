import { createDatabase } from '@appsolo/database';
import { createApp } from './app.js';
import { parseApiConfig } from './config/env.js';
const config = parseApiConfig();
const { db, pool } = createDatabase(config.DATABASE_URL);
const server = createApp({ db, config }).listen(config.PORT, () => console.log(`API listening at http://localhost:${config.PORT}`));
const shutdown = () => server.close(() => { void pool.end().finally(() => process.exit(0)); });
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
