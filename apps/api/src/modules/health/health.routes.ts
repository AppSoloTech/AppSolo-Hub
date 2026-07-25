import { Router } from 'express';
import type { Database } from '@appsolo/database';
import { AppError } from '../../errors.js';

export function healthRouter(db: Database, checkDatabase?: () => Promise<void>): Router {
  const router = Router();
  router.get('/health', async (request, response, next) => {
    try {
      await (checkDatabase?.() ?? db.execute('select 1'));
      response.json({
        data: { status: 'ok', database: 'ok' },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      request.log.error({ err: error }, 'database readiness check failed');
      next(new AppError('DATABASE_UNAVAILABLE', 503, 'The service is temporarily unavailable.'));
    }
  });
  return router;
}
