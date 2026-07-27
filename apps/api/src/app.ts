import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import pino, { type DestinationStream } from 'pino';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import type { Database } from '@appsolo/database';
import type { ApiConfig } from './config/env.js';
import { AppError, validationError } from './errors.js';
import { developmentAuthentication } from './middleware/development-auth.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { authenticatedAccessRouter, publicInvitationRouter } from './modules/access/access.routes.js';
import { AccessRepository } from './modules/access/repository.js';
import { AccessService, type Clock, type TokenGenerator } from './modules/access/service.js';
import { changeRequestRouter } from './modules/change-requests/change-request.routes.js';
import { ChangeRequestRepository } from './modules/change-requests/repository.js';
import { ChangeRequestService } from './modules/change-requests/service.js';
import { commentRouter } from './modules/comments/comment.routes.js';
import { CommentRepository } from './modules/comments/repository.js';
import { CommentService } from './modules/comments/service.js';
import { healthRouter } from './modules/health/health.routes.js';
import { estimateRouter } from './modules/estimates/estimate.routes.js';
import { EstimateRepository } from './modules/estimates/repository.js';
import { EstimateService } from './modules/estimates/service.js';
import { SessionRepository } from './modules/session/repository.js';
import { authenticatedSessionRouter, developmentSessionRouter } from './modules/session/session.routes.js';
import { SessionService } from './modules/session/service.js';

type AppDependencies = {
  db: Database;
  config: ApiConfig;
  clock?: Clock;
  tokenGenerator?: TokenGenerator;
  logDestination?: DestinationStream;
};
const toDetails = (error: ZodError) =>
  error.issues.map((issue) => ({ path: issue.path.join('.') || 'request', message: issue.message }));
const bodyErrorType = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'type' in error && typeof error.type === 'string'
    ? error.type
    : undefined;
const stringProperty = (value: unknown, property: string): string | undefined =>
  typeof value === 'object' &&
  value !== null &&
  property in value &&
  typeof value[property as keyof typeof value] === 'string'
    ? value[property as keyof typeof value]
    : undefined;
const safeErrorSerializer = (error: unknown) => {
  const type =
    error instanceof Error
      ? error.name
      : (stringProperty(error, 'name') ?? stringProperty(error, 'type') ?? 'UnknownError');
  const code =
    stringProperty(error, 'code') ??
    (typeof error === 'object' && error !== null && 'cause' in error
      ? stringProperty(error.cause, 'code')
      : undefined);
  return code ? { type, code } : { type };
};

export function createApp(dependencies: AppDependencies): Express {
  const { db, config } = dependencies;
  const app = express();
  const logger = pino(
    {
      level: config.LOG_LEVEL,
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.x-dev-user-id',
        'req.body',
        'DATABASE_URL',
      ],
      serializers: { err: safeErrorSerializer },
    },
    dependencies.logDestination,
  );
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (request) => request.requestId,
      quietReqLogger: true,
      serializers: { err: safeErrorSerializer },
      customAttributeKeys: { reqId: 'requestId' },
      customProps: (request) =>
        request.authenticatedUser ? { userId: request.authenticatedUser.userId } : {},
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: false }));
  app.use(express.json({ limit: config.REQUEST_BODY_LIMIT }));
  app.use('/api/v1', healthRouter(db));
  const sessionRepository = new SessionRepository(db);
  const sessionService = new SessionService(sessionRepository);
  const webAcceptanceBaseUrl = config.WEB_ACCEPTANCE_BASE_URL ?? config.CORS_ORIGIN[0];
  if (!webAcceptanceBaseUrl) {
    throw new Error('A web acceptance base URL is required.');
  }
  const accessService = new AccessService(
    new AccessRepository(db),
    sessionService,
    webAcceptanceBaseUrl,
    dependencies.clock,
    dependencies.tokenGenerator,
  );
  app.use('/api/v1', developmentSessionRouter(config, sessionService));
  app.use('/api/v1', publicInvitationRouter(accessService));
  const changeRequestRepository = new ChangeRequestRepository(db);
  const estimateService = new EstimateService(new EstimateRepository(db));
  const commentService = new CommentService(new CommentRepository(db));
  app.use(
    '/api/v1',
    developmentAuthentication(config, sessionRepository),
    authenticatedSessionRouter(sessionService),
    authenticatedAccessRouter(accessService),
    changeRequestRouter(new ChangeRequestService(changeRequestRepository)),
    estimateRouter(estimateService),
    commentRouter(commentService),
  );
  app.use((_request, _response, next) =>
    next(new AppError('NOT_FOUND', 404, 'The requested resource was not found.')),
  );
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    void _next;
    const type = bodyErrorType(error);
    const known =
      error instanceof AppError
        ? error
        : error instanceof ZodError
          ? validationError(toDetails(error))
          : type === 'entity.parse.failed'
            ? validationError([{ path: 'body', message: 'Malformed JSON body.' }])
            : type === 'entity.too.large'
              ? new AppError('PAYLOAD_TOO_LARGE', 413, 'The request body is too large.')
              : new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.');
    if (!(error instanceof AppError) && !(error instanceof ZodError) && !type)
      request.log.error({ err: error }, 'unhandled request error');
    response.status(known.status).json({
      error: {
        code: known.code,
        message: known.message,
        details: known.details,
        requestId: request.requestId,
      },
    });
  });
  return app;
}
