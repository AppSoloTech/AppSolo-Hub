import type { ChangeRequestDto, CreateChangeRequestInput, SuccessEnvelope } from '@appsolo/shared';
import { env } from './env.js';
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(env.VITE_DEV_AUTH_USER_ID ? { 'x-dev-user-id': env.VITE_DEV_AUTH_USER_ID } : {}),
      ...init?.headers,
    },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error =
      typeof body === 'object' && body && 'error' in body
        ? (body as { error: { code?: string; message?: string } }).error
        : {};
    throw new ApiError(response.status, error.code ?? 'REQUEST_FAILED', error.message ?? 'Request failed.');
  }
  return body as T;
}
export const requestsApi = {
  list: (projectId: string) =>
    api<SuccessEnvelope<ChangeRequestDto[]>>(`/projects/${projectId}/change-requests`),
  detail: (id: string) => api<SuccessEnvelope<ChangeRequestDto>>(`/change-requests/${id}`),
  create: (projectId: string, input: CreateChangeRequestInput) =>
    api<SuccessEnvelope<ChangeRequestDto>>(`/projects/${projectId}/change-requests`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
