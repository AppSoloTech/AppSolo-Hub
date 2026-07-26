import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EstimateSection } from './EstimateSection.js';

const { list, create, update, submit, respond } = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  submit: vi.fn(),
  respond: vi.fn(),
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
  estimatesApi: { list, create, update, submit, respond },
}));

const estimate = {
  id: '50000000-0000-4000-8000-000000000002',
  changeRequestId: '30000000-0000-4000-8000-000000000003',
  version: 1,
  estimatedHours: '3.25',
  hourlyRate: '140.00',
  estimatedCost: '455.00',
  scopeNotes: 'Implement and verify accessible saved report filters.',
  status: 'SUBMITTED',
  creatorDisplayName: 'Devon Developer',
  submittedAt: '2026-07-26T14:00:00.000Z',
  createdAt: '2026-07-26T13:00:00.000Z',
  updatedAt: '2026-07-26T14:00:00.000Z',
  response: null,
} as const;

const renderSection = (status: 'SUBMITTED' | 'AWAITING_ESTIMATE' | 'AWAITING_APPROVAL' = 'SUBMITTED') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EstimateSection changeRequestId={estimate.changeRequestId} requestStatus={status} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  list.mockReset();
  create.mockReset();
  update.mockReset();
  submit.mockReset();
  respond.mockReset();
});
afterEach(cleanup);

describe('estimate workflow UI', () => {
  it('lets a manager validate exact terms, see derived USD cost, and create a normalized draft', async () => {
    list.mockResolvedValue({ data: [], meta: { count: 0, canManage: true, canRespond: false } });
    create.mockResolvedValue({ data: { ...estimate, status: 'DRAFT' }, meta: {} });
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByRole('heading', { name: 'Prepare an estimate' })).toBeVisible();
    await user.type(screen.getByLabelText('Estimated hours'), '1.5');
    await user.type(screen.getByLabelText('Hourly rate (USD)'), '0.01');
    await user.type(screen.getByLabelText('Scope notes'), 'Implement the approved exact estimate scope.');
    expect(screen.getByLabelText('Estimated cost (server-derived)')).toHaveTextContent('$0.02');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(create).toHaveBeenCalledWith(estimate.changeRequestId, {
      estimatedHours: '1.50',
      hourlyRate: '0.01',
      scopeNotes: 'Implement the approved exact estimate scope.',
    });
    expect(await screen.findByText('Draft estimate created.')).toBeVisible();
  });

  it('associates each invalid estimate term with an assertive field description', async () => {
    list.mockResolvedValue({ data: [], meta: { count: 0, canManage: true, canRespond: false } });
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('heading', { name: 'Prepare an estimate' });
    await user.click(screen.getByRole('button', { name: 'Create draft' }));

    const hours = screen.getByLabelText('Estimated hours');
    const rate = screen.getByLabelText('Hourly rate (USD)');
    const scope = screen.getByLabelText('Scope notes');
    expect(hours).toHaveAccessibleName('Estimated hours');
    expect(hours).toHaveAccessibleDescription();
    expect(rate).toHaveAccessibleDescription();
    expect(scope).toHaveAccessibleDescription();
    for (const input of [hours, rate, scope]) {
      const descriptionId = input.getAttribute('aria-describedby');
      expect(descriptionId).toBeTruthy();
      expect(document.getElementById(descriptionId ?? '')).toHaveAttribute('role', 'alert');
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('shows submitted history to a client member without draft or response controls', async () => {
    list.mockResolvedValue({
      data: [estimate],
      meta: { count: 1, canManage: false, canRespond: false },
    });
    renderSection('AWAITING_APPROVAL');

    expect(await screen.findByRole('heading', { name: 'Submitted' })).toBeVisible();
    expect(screen.getByText('$455.00')).toBeVisible();
    expect(screen.queryByText('Edit draft estimate')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve estimate' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Create estimate draft/)).not.toBeInTheDocument();
  });

  it('requires a reason and sends the client-admin clarification command', async () => {
    list.mockResolvedValue({
      data: [estimate],
      meta: { count: 1, canManage: false, canRespond: true },
    });
    respond.mockResolvedValue({
      data: { ...estimate, status: 'NEEDS_CLARIFICATION' },
      meta: {},
    });
    const user = userEvent.setup();
    renderSection('AWAITING_APPROVAL');

    await screen.findByRole('heading', { name: 'Respond to version 1' });
    await user.click(screen.getByRole('button', { name: 'Request clarification' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 3 characters');
    await user.type(screen.getByLabelText('Decision note'), 'Please clarify the excluded filters.');
    await user.click(screen.getByRole('button', { name: 'Request clarification' }));
    expect(respond).toHaveBeenCalledWith(estimate.id, {
      decision: 'REQUEST_CLARIFICATION',
      note: 'Please clarify the excluded filters.',
      expectedUpdatedAt: estimate.updatedAt,
    });
    expect(await screen.findByText('Clarification requested.')).toBeVisible();
  });

  it('announces stale-state conflicts and refetches the latest draft', async () => {
    const draft = { ...estimate, status: 'DRAFT' as const, submittedAt: null };
    const latestDraft = {
      ...draft,
      estimatedHours: '6.00',
      hourlyRate: '150.00',
      estimatedCost: '900.00',
      scopeNotes: 'Terms saved by another manager and reloaded after conflict.',
      updatedAt: '2026-07-26T15:00:00.000Z',
    };
    list
      .mockResolvedValueOnce({
        data: [draft],
        meta: { count: 1, canManage: true, canRespond: false },
      })
      .mockResolvedValue({
        data: [latestDraft],
        meta: { count: 1, canManage: true, canRespond: false },
      });
    const { ApiError } = await import('../../api.js');
    update.mockRejectedValue(new ApiError(409, 'CONFLICT', 'Conflict'));
    const user = userEvent.setup();
    renderSection('AWAITING_ESTIMATE');

    await screen.findByRole('heading', { name: 'Edit draft estimate' });
    await user.clear(screen.getByLabelText('Estimated hours'));
    await user.type(screen.getByLabelText('Estimated hours'), '4.00');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    const alert = await screen.findByText(/This estimate changed or is no longer actionable\./);
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveClass('error');
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Estimated hours')).toHaveValue('6.00');
    expect(screen.getByLabelText('Hourly rate (USD)')).toHaveValue('150.00');
    expect(screen.getByLabelText('Scope notes')).toHaveValue(latestDraft.scopeNotes);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
