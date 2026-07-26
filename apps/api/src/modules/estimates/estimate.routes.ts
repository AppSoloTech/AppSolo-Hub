import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  createEstimateSchema,
  respondToEstimateSchema,
  submitEstimateSchema,
  updateEstimateSchema,
  uuidSchema,
} from '@appsolo/shared';
import { AppError } from '../../errors.js';
import type { EstimateService } from './service.js';

const userId = (request: Request): string => {
  if (!request.authenticatedUser) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
  return request.authenticatedUser.userId;
};
const emptyQuerySchema = z.object({}).strict();

export function estimateRouter(service: EstimateService): Router {
  const router = Router();
  router.get('/change-requests/:changeRequestId/estimates', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      emptyQuerySchema.parse(request.query);
      response.json(await service.list(changeRequestId, userId(request)));
    })().catch(next);
  });
  router.post('/change-requests/:changeRequestId/estimates', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      emptyQuerySchema.parse(request.query);
      response
        .status(201)
        .json(
          await service.create(changeRequestId, userId(request), createEstimateSchema.parse(request.body)),
        );
    })().catch(next);
  });
  router.patch('/estimates/:estimateId', (request, response, next) => {
    void (async () => {
      const estimateId = uuidSchema.parse(request.params.estimateId);
      emptyQuerySchema.parse(request.query);
      response.json(
        await service.update(estimateId, userId(request), updateEstimateSchema.parse(request.body)),
      );
    })().catch(next);
  });
  router.post('/estimates/:estimateId/submit', (request, response, next) => {
    void (async () => {
      const estimateId = uuidSchema.parse(request.params.estimateId);
      emptyQuerySchema.parse(request.query);
      const input = submitEstimateSchema.parse(request.body);
      response.json(await service.submit(estimateId, userId(request), input.expectedUpdatedAt));
    })().catch(next);
  });
  router.post('/estimates/:estimateId/respond', (request, response, next) => {
    void (async () => {
      const estimateId = uuidSchema.parse(request.params.estimateId);
      emptyQuerySchema.parse(request.query);
      response.json(
        await service.respond(estimateId, userId(request), respondToEstimateSchema.parse(request.body)),
      );
    })().catch(next);
  });
  return router;
}
