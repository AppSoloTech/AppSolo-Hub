import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentSection } from './CommentSection.js';

const { list, create } = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
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
  commentsApi: { list, create },
  currentDevelopmentUserId: () => '20000000-0000-4000-8000-000000000001',
}));

const changeRequestId = '30000000-0000-4000-8000-000000000006';
const sharedComment = {
  id: '60000000-0000-4000-8000-000000000003',
  changeRequestId,
  body: 'The warning threshold should apply to monthly totals.',
  visibility: 'CLIENT_VISIBLE' as const,
  authorDisplayName: 'Casey Admin',
  createdAt: '2026-07-26T14:00:00.000Z',
};
const internalMeta = {
  count: 1,
  limit: 20,
  offset: 0,
  canCreateClientComments: true,
  canViewInternalComments: true,
  canCreateInternalComments: true,
};
const clientMeta = {
  ...internalMeta,
  canViewInternalComments: false,
  canCreateInternalComments: false,
};

const renderSection = (status: 'SUBMITTED' | 'NEEDS_CLARIFICATION' = 'SUBMITTED') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CommentSection changeRequestId={changeRequestId} requestStatus={status} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  list.mockReset();
  create.mockReset();
});
afterEach(cleanup);

describe('request conversation UI', () => {
  it('defaults every internal composer to internal only and resets safely after success', async () => {
    list.mockResolvedValue({ data: [sharedComment], meta: internalMeta });
    create.mockResolvedValue({
      data: { ...sharedComment, id: '60000000-0000-4000-8000-000000000099' },
      meta: {},
    });
    const user = userEvent.setup();
    renderSection();

    const selector = await screen.findByLabelText('Who can see this?');
    expect(selector).toHaveValue('INTERNAL_ONLY');
    await user.selectOptions(selector, 'CLIENT_VISIBLE');
    await user.type(screen.getByLabelText('Comment'), '  Deliberately shared update.  ');
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(create).toHaveBeenCalledWith(changeRequestId, {
      body: 'Deliberately shared update.',
      visibility: 'CLIENT_VISIBLE',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Comment added.');
    expect(screen.getByLabelText('Comment')).toHaveValue('');
    expect(selector).toHaveValue('INTERNAL_ONLY');
  });

  it('gives client roles only an explicitly shared composer and no internal artifact', async () => {
    list.mockResolvedValue({ data: [sharedComment], meta: clientMeta });
    create.mockResolvedValue({ data: sharedComment, meta: {} });
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByText('Shared with client')).toBeVisible();
    expect(screen.queryByLabelText('Who can see this?')).not.toBeInTheDocument();
    expect(screen.queryByText('Internal only')).not.toBeInTheDocument();
    expect(screen.getByText('Your comment will be shared with the client team.')).toBeVisible();
    await user.type(screen.getByLabelText('Comment'), 'Client visible reply');
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(create).toHaveBeenCalledWith(changeRequestId, {
      body: 'Client visible reply',
      visibility: 'CLIENT_VISIBLE',
    });
  });

  it('preserves recoverable input and announces validation and server errors', async () => {
    list.mockResolvedValue({ data: [], meta: internalMeta });
    const { ApiError } = await import('../../api.js');
    create.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Permission changed.'));
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('heading', { name: 'New comment' });
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Comment is required.');
    await user.type(screen.getByLabelText('Comment'), 'Keep this recoverable text');
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission changed.');
    expect(screen.getByLabelText('Comment')).toHaveValue('Keep this recoverable text');
  });

  it('connects clarification guidance to discussion and supports deterministic pagination', async () => {
    list
      .mockResolvedValueOnce({
        data: [sharedComment],
        meta: { ...internalMeta, count: 20 },
      })
      .mockResolvedValue({
        data: [{ ...sharedComment, id: '60000000-0000-4000-8000-000000000004' }],
        meta: { ...internalMeta, offset: 20 },
      });
    const user = userEvent.setup();
    renderSection('NEEDS_CLARIFICATION');

    expect(await screen.findByText('Clarification is needed.')).toBeVisible();
    expect(screen.getByText(/adding a comment does not resolve the clarification/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /resolve/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Later comments' }));
    expect(list).toHaveBeenLastCalledWith(changeRequestId, 20, 20);
    expect(await screen.findByText('Comments 21–21')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Earlier comments' })).toBeEnabled();
  });
});
