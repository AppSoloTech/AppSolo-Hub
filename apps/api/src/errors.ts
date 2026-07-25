import type { ErrorDetail } from '@appsolo/shared';
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
  }
}
export const validationError = (details: ErrorDetail[]) =>
  new AppError('VALIDATION_ERROR', 400, 'The request could not be processed.', details);
