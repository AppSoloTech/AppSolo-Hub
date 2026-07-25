import { Router } from 'express';
import type { Logger } from 'pino';
import type { Database } from '@appsolo/database';
import { AppError } from '../../errors.js';

export function healthRouter(db: Database, logger: Logger, checkDatabase?: () => Promise<void>): Router {
  const router = Router();
  router.get('/health', async (_request, response, next) => {
    try {
      await (checkDatabase?.() ?? db.execute('select 1'));
      response.json({
        data: { status: 'ok', database: 'ok' },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      logger.error({ err: error }, 'database readiness check failed');
      next(new AppError('DATABASE_UNAVAILABLE', 503, 'The service is temporarily unavailable.'));
    }
  });
  return router;
}
