import type { RequestHandler } from 'express';

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  const supplied = request.header('x-request-id');
  request.requestId = supplied && /^[A-Za-z0-9_-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
  response.setHeader('x-request-id', request.requestId);
  next();
};
