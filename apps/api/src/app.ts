import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import type { Database } from '@appsolo/database';
import { createChangeRequestSchema, paginationSchema, uuidSchema } from '@appsolo/shared';
import type { ApiConfig } from './config/env.js';
import { AppError, validationError } from './errors.js';
import { ChangeRequestRepository } from './modules/change-requests/repository.js';
import { ChangeRequestService } from './modules/change-requests/service.js';

type AppDependencies = { db: Database; config: ApiConfig; checkDatabase?: () => Promise<void> };
const toDetails = (error: ZodError) => error.issues.map((issue) => ({ path: issue.path.join('.') || 'request', message: issue.message }));
const asyncRoute = (fn: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };

export function createApp({ db, config, checkDatabase }: AppDependencies): Express {
  const app = express();
  const logger = pino({ level: config.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.x-dev-user-id', 'DATABASE_URL'] });
  app.disable('x-powered-by');
  app.use((request, response, next) => { const supplied = request.header('x-request-id'); request.requestId = supplied && /^[A-Za-z0-9_-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID(); response.setHeader('x-request-id', request.requestId); next(); });
  app.use(pinoHttp({ logger, customProps: (request) => ({ requestId: request.requestId, userId: request.authenticatedUser?.userId }) }));
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: false }));
  app.use(express.json({ limit: config.REQUEST_BODY_LIMIT }));

  const repository = new ChangeRequestRepository(db);
  const service = new ChangeRequestService(repository);
  const authenticate = async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
    if (!config.DEV_AUTH_ENABLED) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
    const userId = request.header('x-dev-user-id') ?? config.DEV_AUTH_USER_ID;
    if (!userId || !uuidSchema.safeParse(userId).success) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
    const user = await repository.findActiveUser(userId);
    if (!user) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
      request.authenticatedUser = { userId: user.id, email: user.email };
      next();
    } catch (error) { next(error); }
  };

  app.get('/api/v1/health', asyncRoute(async (_request, response) => {
    try { await (checkDatabase?.() ?? db.execute('select 1')); response.status(200).json({ data: { status: 'ok', database: 'ok' }, meta: { timestamp: new Date().toISOString() } }); }
    catch (error) { logger.error({ err: error }, 'database readiness check failed'); throw new AppError('DATABASE_UNAVAILABLE', 503, 'The service is temporarily unavailable.'); }
  }));
  const router = express.Router();
  router.use(authenticate);
  router.get('/projects/:projectId/change-requests', asyncRoute(async (request, response) => { const projectId = uuidSchema.parse(request.params.projectId); const query = paginationSchema.parse(request.query); response.json(await service.list(projectId, request.authenticatedUser!.userId, query.limit, query.offset)); }));
  router.post('/projects/:projectId/change-requests', asyncRoute(async (request, response) => { const projectId = uuidSchema.parse(request.params.projectId); const input = createChangeRequestSchema.parse(request.body); response.status(201).json(await service.create(projectId, request.authenticatedUser!.userId, input)); }));
  router.get('/change-requests/:changeRequestId', asyncRoute(async (request, response) => { const id = uuidSchema.parse(request.params.changeRequestId); response.json(await service.detail(id, request.authenticatedUser!.userId)); }));
  app.use('/api/v1', router);
  app.use((_request, _response, next) => next(new AppError('NOT_FOUND', 404, 'The requested resource was not found.')));
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    void _next;
    const known = error instanceof AppError ? error : error instanceof ZodError ? validationError(toDetails(error)) : new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.');
    if (!(error instanceof AppError) && !(error instanceof ZodError)) request.log.error({ err: error }, 'unhandled request error');
    response.status(known.status).json({ error: { code: known.code, message: known.message, details: known.details, requestId: request.requestId } });
  });
  return app;
}
