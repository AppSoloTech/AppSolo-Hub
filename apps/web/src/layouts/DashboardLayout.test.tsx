import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDto } from '@appsolo/shared';
import { applyTheme, themeStorageKey } from '../theme.js';
import { DashboardLayout } from './DashboardLayout.js';

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock('../session/SessionProvider.js', () => ({ useSession }));

const session: SessionDto = {
  user: {
    id: '20000000-0000-4000-8000-000000000001',
    email: 'owner@appsolo.test',
    firstName: 'Avery',
    lastName: 'Owner',
  },
  memberships: [
    {
      id: '40000000-0000-4000-8000-000000000001',
      organizationId: '10000000-0000-4000-8000-000000000001',
      organizationName: 'AppSolo',
      organizationType: 'INTERNAL',
      role: 'OWNER',
      status: 'ACTIVE',
      capabilities: ['VIEW_CHANGE_REQUESTS', 'VIEW_MEMBERS'],
      updatedAt: '2026-07-26T12:00:00.000Z',
    },
    {
      id: '40000000-0000-4000-8000-000000000003',
      organizationId: '10000000-0000-4000-8000-000000000002',
      organizationName: 'Northstar Demo Co.',
      organizationType: 'CLIENT',
      role: 'OWNER',
      status: 'ACTIVE',
      capabilities: ['VIEW_CHANGE_REQUESTS', 'VIEW_MEMBERS'],
      updatedAt: '2026-07-26T12:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  applyTheme('light');
});

afterEach(() => {
  cleanup();
});

describe('DashboardLayout organization context', () => {
  it('shows the organization selected by an access route', () => {
    useSession.mockReturnValue({ session, signOut: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/organizations/10000000-0000-4000-8000-000000000002/access']}>
        <DashboardLayout>
          <div>Access content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );
    expect(screen.getByText('Northstar Demo Co.')).toBeVisible();
  });

  it('uses a neutral label outside organization-scoped routes when multiple memberships exist', () => {
    useSession.mockReturnValue({ session, signOut: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/projects/project-id/change-requests']}>
        <DashboardLayout>
          <div>Project content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );
    expect(screen.getByText('Multiple authorized organizations')).toBeVisible();
  });
});

describe('DashboardLayout theme control', () => {
  it('switches theme and saves the preference', async () => {
    useSession.mockReturnValue({ session, signOut: vi.fn() });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/projects/project-id/change-requests']}>
        <DashboardLayout>
          <div>Project content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: 'Switch to dark mode' });
    await user.click(toggle);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(themeStorageKey)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveTextContent('Light mode');
  });
});
