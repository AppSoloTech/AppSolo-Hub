import { Router, type Request } from 'express';
import { developmentSignInSchema } from '@appsolo/shared';
import type { ApiConfig } from '../../config/env.js';
import { AppError } from '../../errors.js';
import type { SessionService } from './service.js';

const userId = (request: Request): string => {
  if (!request.authenticatedUser) {
    throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
  }
  return request.authenticatedUser.userId;
};

export function developmentSessionRouter(config: ApiConfig, service: SessionService): Router {
  const router = Router();
  router.post('/development/session', (request, response, next) => {
    void (async () => {
      if (!config.DEV_AUTH_ENABLED || config.NODE_ENV === 'production') {
        throw new AppError('NOT_FOUND', 404, 'The requested resource was not found.');
      }
      const input = developmentSignInSchema.parse(request.body);
      response.json({ data: await service.developmentSignIn(input.email), meta: {} });
    })().catch(next);
  });
  return router;
}

export function authenticatedSessionRouter(service: SessionService): Router {
  const router = Router();
  router.get('/session', (request, response, next) => {
    void (async () => {
      response.json({ data: await service.forUser(userId(request)), meta: {} });
    })().catch(next);
  });
  return router;
}
