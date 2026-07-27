import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeRequestDto, RequestHistoryItem, TimeEntryDto } from '@appsolo/shared';
import { WorkSection } from './WorkSection.js';

const api = vi.hoisted(() => ({
  history: vi.fn(),
  timeEntries: vi.fn(),
  createTimeEntry: vi.fn(),
  voidTimeEntry: vi.fn(),
  start: vi.fn(),
  createHandoff: vi.fn(),
  respond: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../../api.js', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  currentDevelopmentUserId: () => '20000000-0000-4000-8000-000000000001',
  workApi: api,
}));

const request = {
  id: '30000000-0000-4000-8000-000000000004',
  projectId: '10000000-0000-4000-8000-000000000003',
  submittedByUserId: '20000000-0000-4000-8000-000000000003',
  title: 'Improve export progress feedback',
  description: 'Show clear progress while a large export is prepared.',
  priority: 'LOW',
  status: 'APPROVED',
  requestedCompletionDate: null,
  createdAt: '2026-07-25T12:00:00.000Z',
  updatedAt: '2026-07-27T12:00:00.000Z',
} satisfies ChangeRequestDto;

const handoff = {
  id: '62000000-0000-4000-8000-000000000001',
  changeRequestId: request.id,
  version: 1,
  workSummary: 'Completed the approved delivery scope and verification.',
  releaseNotes: 'Review the updated progress feedback.',
  actorDisplayName: 'Devon Developer',
  createdAt: '2026-07-27T13:00:00.000Z',
  response: null,
};

const historyItem = {
  id: 'STATUS_CHANGED:70000000-0000-4000-8000-000000000001',
  sourceId: '70000000-0000-4000-8000-000000000001',
  kind: 'STATUS_CHANGED' as const,
  eventTime: '2026-07-25T12:00:00.000Z',
  actorDisplayName: 'Casey Admin',
  previousStatus: 'AWAITING_APPROVAL' as const,
  newStatus: 'APPROVED' as const,
  note: null,
};

const timeEntry = {
  id: '61000000-0000-4000-8000-000000000001',
  changeRequestId: request.id,
  durationMinutes: 45,
  description: 'Verified the complete workflow.',
  workDate: '2026-07-27',
  authorUserId: '20000000-0000-4000-8000-000000000001',
  authorDisplayName: 'Avery Owner',
  createdAt: '2026-07-27T12:00:00.000Z',
  updatedAt: '2026-07-27T12:00:00.000Z',
  voidedAt: null,
  voidReason: null,
  voidedByUserId: null,
  voidedByDisplayName: null,
} satisfies TimeEntryDto;

const historyResponse = (
  overrides: Partial<{
    canManageWork: boolean;
    canRespondToReview: boolean;
    canCancel: boolean;
    canViewPrivateTime: boolean;
    currentHandoff: typeof handoff | null;
  }> = {},
  data: RequestHistoryItem[] = [historyItem],
) => ({
  data,
  meta: {
    count: data.length,
    limit: 11,
    offset: 0,
    canManageWork: false,
    canRespondToReview: false,
    canCancel: false,
    canViewPrivateTime: false,
    currentHandoff: null,
    ...overrides,
  },
});

const renderSection = (value: ChangeRequestDto = request) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WorkSection request={value} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
});
afterEach(cleanup);

describe('P005 work and history UI', () => {
  it('gives client roles shared work history with no private-time artifact or request', async () => {
    api.history.mockResolvedValue(historyResponse({ currentHandoff: handoff }));
    renderSection({
      ...request,
      status: 'READY_FOR_REVIEW',
    });

    expect(await screen.findByRole('heading', { name: 'Delivery summary' })).toBeVisible();
    expect(screen.getByText(handoff.workSummary)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Complete history' })).toBeVisible();
    expect(screen.queryByText('Private time')).not.toBeInTheDocument();
    expect(screen.queryByText(/internal only/i)).not.toBeInTheDocument();
    expect(api.timeEntries).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
  });

  it('starts approved work only for an authorized internal manager', async () => {
    api.history.mockResolvedValue(
      historyResponse({
        canManageWork: true,
        canCancel: true,
        canViewPrivateTime: true,
      }),
    );
    api.timeEntries.mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        limit: 6,
        offset: 0,
        activeDurationMinutes: 0,
        canCreate: true,
        canVoidOwn: true,
        canManage: true,
      },
    });
    api.start.mockResolvedValue({
      data: {
        changeRequestId: request.id,
        status: 'IN_PROGRESS',
        updatedAt: '2026-07-27T12:01:00.000Z',
        handoff: null,
      },
      meta: {},
    });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Start work' }));
    expect(api.start).toHaveBeenCalledWith(request.id, request.updatedAt);
    expect(await screen.findByRole('status')).toHaveTextContent('Work started.');
    expect(screen.getByRole('heading', { name: 'Private time' })).toBeVisible();
  });

  it('records normalized private time and preserves input on server failure', async () => {
    api.history.mockResolvedValue(
      historyResponse({
        canManageWork: true,
        canViewPrivateTime: true,
      }),
    );
    api.timeEntries.mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        limit: 6,
        offset: 0,
        activeDurationMinutes: 0,
        canCreate: true,
        canVoidOwn: true,
        canManage: false,
      },
    });
    const { ApiError } = await import('../../api.js');
    api.createTimeEntry.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Conflict'));
    const user = userEvent.setup();
    renderSection({ ...request, status: 'IN_PROGRESS' });

    await screen.findByRole('heading', { name: 'Record private time' });
    await user.type(screen.getByLabelText('Duration in minutes'), '45');
    await user.type(screen.getByLabelText('Work description'), '  Verified the complete workflow.  ');
    await user.type(screen.getByLabelText('Work date'), '2026-07-27');
    await user.click(screen.getByRole('button', { name: 'Record time' }));
    expect(api.createTimeEntry).toHaveBeenCalledWith(request.id, {
      durationMinutes: 45,
      description: 'Verified the complete workflow.',
      workDate: '2026-07-27',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This request changed or is no longer actionable.',
    );
    expect(screen.getByLabelText('Work description')).toHaveValue('  Verified the complete workflow.  ');
  });

  it('shows no own-only void control for another author', async () => {
    api.history.mockResolvedValue(
      historyResponse({
        canManageWork: true,
        canViewPrivateTime: true,
      }),
    );
    api.timeEntries.mockResolvedValue({
      data: [
        {
          ...timeEntry,
          authorUserId: '20000000-0000-4000-8000-000000000002',
          authorDisplayName: 'Devon Developer',
        },
      ],
      meta: {
        count: 1,
        limit: 6,
        offset: 0,
        activeDurationMinutes: 45,
        canCreate: true,
        canVoidOwn: true,
        canManage: false,
      },
    });
    renderSection({ ...request, status: 'IN_PROGRESS' });

    expect(await screen.findByText('Verified the complete workflow.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Void entry' })).not.toBeInTheDocument();
  });

  it('voids an own entry with the exact command and preserves the reason on conflict', async () => {
    api.history.mockResolvedValue(
      historyResponse({
        canManageWork: true,
        canViewPrivateTime: true,
      }),
    );
    api.timeEntries.mockResolvedValue({
      data: [timeEntry],
      meta: {
        count: 1,
        limit: 6,
        offset: 0,
        activeDurationMinutes: 45,
        canCreate: true,
        canVoidOwn: true,
        canManage: false,
      },
    });
    const { ApiError } = await import('../../api.js');
    api.voidTimeEntry.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Conflict'));
    const user = userEvent.setup();
    renderSection({ ...request, status: 'IN_PROGRESS' });

    await user.click(await screen.findByRole('button', { name: 'Void entry' }));
    await user.type(screen.getByLabelText('Void reason'), 'Duplicate work record.');
    await user.click(screen.getByRole('button', { name: 'Confirm void' }));
    expect(api.voidTimeEntry).toHaveBeenCalledWith(timeEntry.id, {
      reason: 'Duplicate work record.',
      expectedUpdatedAt: timeEntry.updatedAt,
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This request changed or is no longer actionable.',
    );
    expect(screen.getByLabelText('Void reason')).toHaveValue('Duplicate work record.');
  });

  it('moves forward and backward through private-time and history pages', async () => {
    const historyItems = Array.from({ length: 11 }, (_, index) => ({
      ...historyItem,
      id: `STATUS_CHANGED:70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      sourceId: `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      note: `History event ${index + 1}`,
    }));
    const timeEntries = Array.from({ length: 6 }, (_, index) => ({
      ...timeEntry,
      id: `61000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      description: `Time entry ${index + 1}`,
    }));
    api.history.mockImplementation((_changeRequestId: string, _limit: number, offset: number) =>
      Promise.resolve(
        historyResponse(
          {
            canManageWork: true,
            canViewPrivateTime: true,
          },
          offset === 0 ? historyItems : historyItems.slice(10),
        ),
      ),
    );
    api.timeEntries.mockImplementation((_changeRequestId: string, _limit: number, offset: number) =>
      Promise.resolve({
        data: offset === 0 ? timeEntries : timeEntries.slice(5),
        meta: {
          count: offset === 0 ? 6 : 1,
          limit: 6,
          offset,
          activeDurationMinutes: 270,
          canCreate: true,
          canVoidOwn: true,
          canManage: true,
        },
      }),
    );
    const user = userEvent.setup();
    renderSection({ ...request, status: 'IN_PROGRESS' });

    await user.click(await screen.findByRole('button', { name: 'Older entries' }));
    await waitFor(() => expect(api.timeEntries).toHaveBeenCalledWith(request.id, 6, 5));
    expect(await screen.findByText('Time entry 6')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Newer entries' }));
    expect(await screen.findByText('Time entry 1')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Later events' }));
    await waitFor(() => expect(api.history).toHaveBeenCalledWith(request.id, 11, 10));
    expect(await screen.findByText('History event 11')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Earlier events' }));
    expect(await screen.findByText('History event 1')).toBeVisible();
  });

  it('requires client change reasons and sends the exact review command', async () => {
    api.history.mockResolvedValue(
      historyResponse({
        canRespondToReview: true,
        canCancel: true,
        currentHandoff: handoff,
      }),
    );
    api.respond.mockResolvedValue({
      data: {
        changeRequestId: request.id,
        status: 'IN_PROGRESS',
        updatedAt: '2026-07-27T14:00:00.000Z',
        handoff: {
          ...handoff,
          response: {
            id: '63000000-0000-4000-8000-000000000001',
            decision: 'CHANGES_REQUESTED',
            note: 'Clarify the final empty state.',
            actorDisplayName: 'Casey Admin',
            createdAt: '2026-07-27T14:00:00.000Z',
          },
        },
      },
      meta: {},
    });
    const user = userEvent.setup();
    renderSection({ ...request, status: 'READY_FOR_REVIEW' });

    await user.click(await screen.findByLabelText('Request changes'));
    await user.click(screen.getByRole('button', { name: 'Request changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Required');
    await user.type(screen.getByLabelText(/^Change reason/), 'Clarify the final empty state.');
    await user.click(screen.getByRole('button', { name: 'Request changes' }));
    expect(api.respond).toHaveBeenCalledWith(handoff.id, {
      decision: 'REQUEST_CHANGES',
      note: 'Clarify the final empty state.',
      expectedUpdatedAt: request.updatedAt,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Changes requested');
  });

  it('requires explicit cancellation confirmation and keeps the reason recoverable', async () => {
    api.history.mockResolvedValue(historyResponse({ canCancel: true }));
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByText('Cancel this request'));
    await user.type(
      screen.getByLabelText('Client-visible cancellation reason'),
      'Client no longer needs this change.',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm that you want to cancel');
    expect(api.cancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Client-visible cancellation reason')).toHaveValue(
      'Client no longer needs this change.',
    );
  });
});
