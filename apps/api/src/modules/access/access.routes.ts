import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  paginationSchema,
  updateMembershipSchema,
  uuidSchema,
} from '@appsolo/shared';
import { AppError } from '../../errors.js';
import type { AccessService } from './service.js';

const emptyBodySchema = z.object({}).strict();
const userId = (request: Request): string => {
  if (!request.authenticatedUser) {
    throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
  }
  return request.authenticatedUser.userId;
};

export function publicInvitationRouter(service: AccessService): Router {
  const router = Router();
  router.post('/invitations/accept', (request, response, next) => {
    void (async () => {
      const input = acceptInvitationSchema.parse(request.body);
      response.json(await service.acceptInvitation(input.token));
    })().catch(next);
  });
  return router;
}

export function authenticatedAccessRouter(service: AccessService): Router {
  const router = Router();
  router.get('/organizations/:organizationId/members', (request, response, next) => {
    void (async () => {
      const organizationId = uuidSchema.parse(request.params.organizationId);
      const query = paginationSchema.parse(request.query);
      response.json(await service.listMembers(organizationId, userId(request), query.limit, query.offset));
    })().catch(next);
  });
  router.patch('/organizations/:organizationId/memberships/:membershipId', (request, response, next) => {
    void (async () => {
      const organizationId = uuidSchema.parse(request.params.organizationId);
      const membershipId = uuidSchema.parse(request.params.membershipId);
      response.json(
        await service.updateMembership(
          organizationId,
          membershipId,
          userId(request),
          updateMembershipSchema.parse(request.body),
        ),
      );
    })().catch(next);
  });
  router.get('/organizations/:organizationId/invitations', (request, response, next) => {
    void (async () => {
      const organizationId = uuidSchema.parse(request.params.organizationId);
      const query = paginationSchema.parse(request.query);
      response.json(
        await service.listInvitations(organizationId, userId(request), query.limit, query.offset),
      );
    })().catch(next);
  });
  router.post('/organizations/:organizationId/invitations', (request, response, next) => {
    void (async () => {
      const organizationId = uuidSchema.parse(request.params.organizationId);
      response
        .status(201)
        .json(
          await service.createInvitation(
            organizationId,
            userId(request),
            createInvitationSchema.parse(request.body),
          ),
        );
    })().catch(next);
  });
  router.post(
    '/organizations/:organizationId/invitations/:invitationId/resend',
    (request, response, next) => {
      void (async () => {
        emptyBodySchema.parse(request.body ?? {});
        response.json(
          await service.resendInvitation(
            uuidSchema.parse(request.params.organizationId),
            uuidSchema.parse(request.params.invitationId),
            userId(request),
          ),
        );
      })().catch(next);
    },
  );
  router.post(
    '/organizations/:organizationId/invitations/:invitationId/revoke',
    (request, response, next) => {
      void (async () => {
        emptyBodySchema.parse(request.body ?? {});
        response.json(
          await service.revokeInvitation(
            uuidSchema.parse(request.params.organizationId),
            uuidSchema.parse(request.params.invitationId),
            userId(request),
          ),
        );
      })().catch(next);
    },
  );
  router.get('/organizations/:organizationId/access-events', (request, response, next) => {
    void (async () => {
      const organizationId = uuidSchema.parse(request.params.organizationId);
      const query = paginationSchema.parse(request.query);
      response.json(
        await service.listAccessEvents(organizationId, userId(request), query.limit, query.offset),
      );
    })().catch(next);
  });
  return router;
}
