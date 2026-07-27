import { Router, type Request } from 'express';
import { commentPaginationSchema, createCommentSchema, uuidSchema } from '@appsolo/shared';
import { AppError } from '../../errors.js';
import type { CommentService } from './service.js';

const userId = (request: Request): string => {
  if (!request.authenticatedUser) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
  return request.authenticatedUser.userId;
};

export function commentRouter(service: CommentService): Router {
  const router = Router();
  router.get('/change-requests/:changeRequestId/comments', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      const query = commentPaginationSchema.parse(request.query);
      response.json(await service.list(changeRequestId, userId(request), query.limit, query.offset));
    })().catch(next);
  });
  router.post('/change-requests/:changeRequestId/comments', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      commentPaginationSchema.pick({}).parse(request.query);
      response
        .status(201)
        .json(
          await service.create(changeRequestId, userId(request), createCommentSchema.parse(request.body)),
        );
    })().catch(next);
  });
  return router;
}
