import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NewChangeRequest } from './NewChangeRequest.js';
const { create } = vi.hoisted(() => ({
  create: vi.fn<(projectId: string, input: unknown) => Promise<{ data: { id: string } }>>(),
}));
vi.mock('../../api.js', () => ({ requestsApi: { create } }));
describe('new change request form', () => {
  it('shows field validation then submits through the public UI', async () => {
    create.mockResolvedValue({ data: { id: '30000000-0000-4000-8000-000000000001' } });
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    queryClient.setQueryData(['change-requests', '10000000-0000-4000-8000-000000000003'], {
      data: [],
      meta: { organizationName: 'Acme Demo Co.', projectName: 'Acme client portal' },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/10000000-0000-4000-8000-000000000003/change-requests/new']}>
          <Routes>
            <Route path="/projects/:projectId/change-requests/new" element={<NewChangeRequest />} />
            <Route path="/change-requests/:changeRequestId" element={<p>Created detail</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Acme Demo Co. · Acme client portal')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByText('Title must be at least 3 characters.')).toBeVisible();
    await user.type(screen.getByLabelText('Title'), 'Export contacts');
    await user.type(
      screen.getByLabelText('Description'),
      'Please let us export filtered contacts as a CSV file.',
    );
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByText('Created detail')).toBeVisible();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
