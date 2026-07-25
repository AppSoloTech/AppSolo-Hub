import { Router, type Request } from 'express';
import { createChangeRequestSchema, paginationSchema, uuidSchema } from '@appsolo/shared';
import { AppError } from '../../errors.js';
import type { ChangeRequestService } from './service.js';

const userId = (request: Request): string => {
  if (!request.authenticatedUser) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
  return request.authenticatedUser.userId;
};

export function changeRequestRouter(service: ChangeRequestService): Router {
  const router = Router();
  router.get('/projects/:projectId/change-requests', (request, response, next) => {
    void (async () => {
      const projectId = uuidSchema.parse(request.params.projectId);
      const query = paginationSchema.parse(request.query);
      response.json(await service.list(projectId, userId(request), query.limit, query.offset));
    })().catch(next);
  });
  router.post('/projects/:projectId/change-requests', (request, response, next) => {
    void (async () => {
      const projectId = uuidSchema.parse(request.params.projectId);
      response
        .status(201)
        .json(
          await service.create(projectId, userId(request), createChangeRequestSchema.parse(request.body)),
        );
    })().catch(next);
  });
  router.get('/change-requests/:changeRequestId', (request, response, next) => {
    void (async () =>
      response.json(
        await service.detail(uuidSchema.parse(request.params.changeRequestId), userId(request)),
      ))().catch(next);
  });
  return router;
}
