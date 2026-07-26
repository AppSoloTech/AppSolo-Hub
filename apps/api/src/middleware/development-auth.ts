import type { RequestHandler } from 'express';
import { uuidSchema } from '@appsolo/shared';
import type { ApiConfig } from '../config/env.js';
import { AppError } from '../errors.js';
import { SessionRepository } from '../modules/session/repository.js';

export function developmentAuthentication(config: ApiConfig, repository: SessionRepository): RequestHandler {
  return (request, _response, next) => {
    void (async () => {
      if (!config.DEV_AUTH_ENABLED) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
      const userId = request.header('x-dev-user-id') ?? config.DEV_AUTH_USER_ID;
      if (!userId || !uuidSchema.safeParse(userId).success)
        throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
      const user = await repository.findActiveUserById(userId);
      if (!user) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
      request.authenticatedUser = { userId: user.id, email: user.email };
    })().then(() => next(), next);
  };
}
