import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ChangeRequestList } from './ChangeRequestList.js';

const { list } = vi.hoisted(() => ({ list: vi.fn() }));

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
  requestsApi: { list },
}));

describe('change request list', () => {
  it('renders the forbidden state from the HTTP status rather than an API message', async () => {
    list.mockRejectedValue(new (await import('../../api.js')).ApiError(403, 'FORBIDDEN', 'Different text'));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/projects/10000000-0000-4000-8000-000000000003/change-requests']}>
          <Routes>
            <Route path="/projects/:projectId/change-requests" element={<ChangeRequestList />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('You do not have access to this project.')).toBeVisible();
  });
});
