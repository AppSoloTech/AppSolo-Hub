import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  cancelChangeRequestSchema,
  createReviewHandoffSchema,
  createTimeEntrySchema,
  p005PaginationSchema,
  respondToReviewHandoffSchema,
  startWorkSchema,
  uuidSchema,
  voidTimeEntrySchema,
} from '@appsolo/shared';
import { AppError } from '../../errors.js';
import type { WorkService } from './service.js';

const emptyQuerySchema = z.object({}).strict();
const userId = (request: Request): string => {
  if (!request.authenticatedUser) throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
  return request.authenticatedUser.userId;
};

export function workRouter(service: WorkService): Router {
  const router = Router();
  router.get('/change-requests/:changeRequestId/time-entries', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      const query = p005PaginationSchema.parse(request.query);
      response.json(
        await service.listTimeEntries(changeRequestId, userId(request), query.limit, query.offset),
      );
    })().catch(next);
  });
  router.post('/change-requests/:changeRequestId/time-entries', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      emptyQuerySchema.parse(request.query);
      response
        .status(201)
        .json(
          await service.createTimeEntry(
            changeRequestId,
            userId(request),
            createTimeEntrySchema.parse(request.body),
          ),
        );
    })().catch(next);
  });
  router.post('/time-entries/:timeEntryId/void', (request, response, next) => {
    void (async () => {
      const timeEntryId = uuidSchema.parse(request.params.timeEntryId);
      emptyQuerySchema.parse(request.query);
      response.json(
        await service.voidTimeEntry(timeEntryId, userId(request), voidTimeEntrySchema.parse(request.body)),
      );
    })().catch(next);
  });
  router.post('/change-requests/:changeRequestId/work/start', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      emptyQuerySchema.parse(request.query);
      const input = startWorkSchema.parse(request.body);
      response.json(await service.startWork(changeRequestId, userId(request), input.expectedUpdatedAt));
    })().catch(next);
  });
  router.post('/change-requests/:changeRequestId/review-handoffs', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      emptyQuerySchema.parse(request.query);
      response
        .status(201)
        .json(
          await service.createHandoff(
            changeRequestId,
            userId(request),
            createReviewHandoffSchema.parse(request.body),
          ),
        );
    })().catch(next);
  });
  router.post('/review-handoffs/:handoffId/respond', (request, response, next) => {
    void (async () => {
      const handoffId = uuidSchema.parse(request.params.handoffId);
      emptyQuerySchema.parse(request.query);
      response.json(
        await service.respondToHandoff(
          handoffId,
          userId(request),
          respondToReviewHandoffSchema.parse(request.body),
        ),
      );
    })().catch(next);
  });
  router.post('/change-requests/:changeRequestId/cancel', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      emptyQuerySchema.parse(request.query);
      response.json(
        await service.cancel(changeRequestId, userId(request), cancelChangeRequestSchema.parse(request.body)),
      );
    })().catch(next);
  });
  router.get('/change-requests/:changeRequestId/history', (request, response, next) => {
    void (async () => {
      const changeRequestId = uuidSchema.parse(request.params.changeRequestId);
      const query = p005PaginationSchema.parse(request.query);
      response.json(await service.history(changeRequestId, userId(request), query.limit, query.offset));
    })().catch(next);
  });
  return router;
}
