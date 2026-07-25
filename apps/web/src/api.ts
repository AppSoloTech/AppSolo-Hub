import type { ChangeRequestDto, CreateChangeRequestInput, SuccessEnvelope } from '@appsolo/shared';
import { env } from './env.js';
export class ApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(env.VITE_DEV_AUTH_USER_ID ? { 'x-dev-user-id': env.VITE_DEV_AUTH_USER_ID } : {}), ...init?.headers } });
  const body: unknown = await response.json();
  if (!response.ok) { const message = typeof body === 'object' && body && 'error' in body ? String((body as { error: { message?: string } }).error.message ?? 'Request failed.') : 'Request failed.'; throw new ApiError(response.status, message); }
  return body as T;
}
export const requestsApi = {
  list: (projectId: string) => api<SuccessEnvelope<ChangeRequestDto[]>>(`/projects/${projectId}/change-requests`),
  detail: (id: string) => api<SuccessEnvelope<ChangeRequestDto>>(`/change-requests/${id}`),
  create: (projectId: string, input: CreateChangeRequestInput) => api<SuccessEnvelope<ChangeRequestDto>>(`/projects/${projectId}/change-requests`, { method: 'POST', body: JSON.stringify(input) }),
};
