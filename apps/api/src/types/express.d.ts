import type { AuthenticatedUser } from '@appsolo/shared';
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      authenticatedUser?: AuthenticatedUser;
    }
  }
}
export {};
