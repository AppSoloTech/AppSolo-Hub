import type {
  AccessEventDto,
  ChangeRequestDto,
  CommentDto,
  CommentListMeta,
  CreateCommentInput,
  CreateChangeRequestInput,
  CreateEstimateInput,
  CreateInvitationInput,
  InvitationDto,
  InvitationMutationDto,
  EstimateDto,
  EstimateListMeta,
  MemberDto,
  SessionDto,
  SuccessEnvelope,
  UpdateMembershipInput,
  UpdateEstimateInput,
  RespondToEstimateInput,
  CancelChangeRequestInput,
  CreateReviewHandoffInput,
  CreateTimeEntryInput,
  RequestHistoryItem,
  RequestHistoryMeta,
  RespondToReviewHandoffInput,
  TimeEntryDto,
  TimeEntryListMeta,
  VoidTimeEntryInput,
  WorkCommandDto,
} from '@appsolo/shared';
import { env } from './env.js';

export const developmentIdentityStorageKey = 'appsolo.developmentUserId';
export const developmentSignedOutStorageKey = 'appsolo.developmentSignedOut';

export function currentDevelopmentUserId(): string | null {
  return window.localStorage.getItem(developmentIdentityStorageKey);
}

export function storeDevelopmentUserId(userId: string): void {
  window.localStorage.setItem(developmentIdentityStorageKey, userId);
  window.localStorage.removeItem(developmentSignedOutStorageKey);
}

export function clearDevelopmentUserId(): void {
  window.localStorage.removeItem(developmentIdentityStorageKey);
  window.localStorage.setItem(developmentSignedOutStorageKey, 'true');
}

export function initializeDevelopmentUserId(): string | null {
  const stored = currentDevelopmentUserId();
  if (stored) return stored;
  if (!window.localStorage.getItem(developmentSignedOutStorageKey) && env.VITE_DEV_AUTH_USER_ID) {
    storeDevelopmentUserId(env.VITE_DEV_AUTH_USER_ID);
    return env.VITE_DEV_AUTH_USER_ID;
  }
  return null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
async function api<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  const developmentUserId = authenticated ? currentDevelopmentUserId() : null;
  const response = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(developmentUserId ? { 'x-dev-user-id': developmentUserId } : {}),
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

export const estimatesApi = {
  list: (changeRequestId: string) =>
    api<{ data: EstimateDto[]; meta: EstimateListMeta }>(`/change-requests/${changeRequestId}/estimates`),
  create: (changeRequestId: string, input: CreateEstimateInput) =>
    api<SuccessEnvelope<EstimateDto>>(`/change-requests/${changeRequestId}/estimates`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (estimateId: string, input: UpdateEstimateInput) =>
    api<SuccessEnvelope<EstimateDto>>(`/estimates/${estimateId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  submit: (estimateId: string, expectedUpdatedAt: string) =>
    api<SuccessEnvelope<EstimateDto>>(`/estimates/${estimateId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ expectedUpdatedAt }),
    }),
  respond: (estimateId: string, input: RespondToEstimateInput) =>
    api<SuccessEnvelope<EstimateDto>>(`/estimates/${estimateId}/respond`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export const commentsApi = {
  list: (changeRequestId: string, limit: number, offset: number) =>
    api<{ data: CommentDto[]; meta: CommentListMeta }>(
      `/change-requests/${changeRequestId}/comments?limit=${limit}&offset=${offset}`,
    ),
  create: (changeRequestId: string, input: CreateCommentInput) =>
    api<SuccessEnvelope<CommentDto>>(`/change-requests/${changeRequestId}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export const workApi = {
  timeEntries: (changeRequestId: string, limit: number, offset: number) =>
    api<{ data: TimeEntryDto[]; meta: TimeEntryListMeta }>(
      `/change-requests/${changeRequestId}/time-entries?limit=${limit}&offset=${offset}`,
    ),
  createTimeEntry: (changeRequestId: string, input: CreateTimeEntryInput) =>
    api<SuccessEnvelope<TimeEntryDto>>(`/change-requests/${changeRequestId}/time-entries`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  voidTimeEntry: (timeEntryId: string, input: VoidTimeEntryInput) =>
    api<SuccessEnvelope<TimeEntryDto>>(`/time-entries/${timeEntryId}/void`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  start: (changeRequestId: string, expectedUpdatedAt: string) =>
    api<SuccessEnvelope<WorkCommandDto>>(`/change-requests/${changeRequestId}/work/start`, {
      method: 'POST',
      body: JSON.stringify({ expectedUpdatedAt }),
    }),
  createHandoff: (changeRequestId: string, input: CreateReviewHandoffInput) =>
    api<SuccessEnvelope<WorkCommandDto>>(`/change-requests/${changeRequestId}/review-handoffs`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  respond: (handoffId: string, input: RespondToReviewHandoffInput) =>
    api<SuccessEnvelope<WorkCommandDto>>(`/review-handoffs/${handoffId}/respond`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  cancel: (changeRequestId: string, input: CancelChangeRequestInput) =>
    api<SuccessEnvelope<WorkCommandDto>>(`/change-requests/${changeRequestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  history: (changeRequestId: string, limit: number, offset: number) =>
    api<{ data: RequestHistoryItem[]; meta: RequestHistoryMeta }>(
      `/change-requests/${changeRequestId}/history?limit=${limit}&offset=${offset}`,
    ),
};

export const sessionApi = {
  signIn: (email: string) =>
    api<SuccessEnvelope<SessionDto>>(
      '/development/session',
      { method: 'POST', body: JSON.stringify({ email }) },
      false,
    ),
  current: () => api<SuccessEnvelope<SessionDto>>('/session'),
};

export const accessApi = {
  members: (organizationId: string) =>
    api<SuccessEnvelope<MemberDto[]>>(`/organizations/${organizationId}/members`),
  invitations: (organizationId: string) =>
    api<SuccessEnvelope<InvitationDto[]>>(`/organizations/${organizationId}/invitations`),
  createInvitation: (organizationId: string, input: CreateInvitationInput) =>
    api<SuccessEnvelope<InvitationMutationDto>>(`/organizations/${organizationId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  resendInvitation: (organizationId: string, invitationId: string) =>
    api<SuccessEnvelope<InvitationMutationDto>>(
      `/organizations/${organizationId}/invitations/${invitationId}/resend`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  revokeInvitation: (organizationId: string, invitationId: string) =>
    api<SuccessEnvelope<InvitationMutationDto>>(
      `/organizations/${organizationId}/invitations/${invitationId}/revoke`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  updateMembership: (organizationId: string, membershipId: string, input: UpdateMembershipInput) =>
    api<SuccessEnvelope<MemberDto>>(`/organizations/${organizationId}/memberships/${membershipId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  events: (organizationId: string) =>
    api<SuccessEnvelope<AccessEventDto[]>>(`/organizations/${organizationId}/access-events`),
  acceptInvitation: (token: string) =>
    api<SuccessEnvelope<SessionDto>>(
      '/invitations/accept',
      { method: 'POST', body: JSON.stringify({ token }) },
      false,
    ),
};
