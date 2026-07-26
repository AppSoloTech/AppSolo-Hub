import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessManagement } from './AccessManagement.js';

const {
  members,
  invitations,
  events,
  createInvitation,
  updateMembership,
  resendInvitation,
  revokeInvitation,
} = vi.hoisted(() => ({
  members: vi.fn(),
  invitations: vi.fn(),
  events: vi.fn(),
  createInvitation: vi.fn(),
  updateMembership: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));

vi.mock('../../api.js', () => ({
  ApiError: class ApiError extends Error {},
  accessApi: {
    members,
    invitations,
    events,
    createInvitation,
    updateMembership,
    resendInvitation,
    revokeInvitation,
  },
}));

vi.mock('../../session/SessionProvider.js', () => ({
  useSession: () => ({
    session: {
      user: {
        id: '20000000-0000-4000-8000-000000000003',
        email: 'admin@client.test',
        firstName: 'Casey',
        lastName: 'Admin',
      },
      memberships: [
        {
          id: '40000000-0000-4000-8000-000000000005',
          organizationId: '10000000-0000-4000-8000-000000000002',
          organizationName: 'Northstar Demo Co.',
          organizationType: 'CLIENT',
          role: 'CLIENT_ADMIN',
          status: 'ACTIVE',
          capabilities: ['VIEW_MEMBERS', 'MANAGE_INVITATIONS', 'MANAGE_MEMBERSHIPS'],
          updatedAt: '2026-07-26T12:00:00.000Z',
        },
      ],
    },
  }),
}));

const owner = {
  membershipId: '40000000-0000-4000-8000-000000000003',
  userId: '20000000-0000-4000-8000-000000000001',
  email: 'owner@appsolo.test',
  firstName: 'Avery',
  lastName: 'Owner',
  userStatus: 'ACTIVE',
  role: 'OWNER',
  status: 'ACTIVE',
  capabilities: [],
  createdAt: '2026-07-26T12:00:00.000Z',
  updatedAt: '2026-07-26T12:00:00.000Z',
};
const clientMember = {
  ...owner,
  membershipId: '40000000-0000-4000-8000-000000000006',
  userId: '20000000-0000-4000-8000-000000000004',
  email: 'member@client.test',
  firstName: 'Morgan',
  lastName: 'Member',
  role: 'CLIENT_MEMBER',
};

beforeEach(() => {
  members.mockResolvedValue({ data: [owner, clientMember], meta: {} });
  invitations.mockResolvedValue({ data: [], meta: {} });
  events.mockResolvedValue({ data: [], meta: {} });
  createInvitation.mockReset();
  updateMembership.mockReset();
});

describe('access management', () => {
  it('hides above-ceiling owner actions and submits the allowed client-member invitation', async () => {
    createInvitation.mockResolvedValue({
      data: {
        invitation: {},
        acceptanceUrl: 'http://localhost:5173/invitations/accept#token=local-token',
      },
      meta: {},
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AccessManagement organizationId="10000000-0000-4000-8000-000000000002" />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Access management' })).toBeVisible();
    expect(screen.queryByLabelText('Role for Avery Owner')).not.toBeInTheDocument();
    const role = screen.getByLabelText('Role');
    expect(role).toHaveTextContent('Client member');
    expect(role).not.toHaveTextContent('Developer');
    await user.type(screen.getByLabelText('First name'), 'Jamie');
    await user.type(screen.getByLabelText('Last name'), 'Invitee');
    await user.type(screen.getByLabelText('Email'), 'jamie@client.test');
    await user.click(screen.getByRole('button', { name: 'Create invitation' }));
    expect(await screen.findByLabelText('Local acceptance link')).toHaveValue(
      'http://localhost:5173/invitations/accept#token=local-token',
    );
    expect(createInvitation).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000002',
      expect.objectContaining({ role: 'CLIENT_MEMBER', email: 'jamie@client.test' }),
    );
  });

  it('exposes allowed suspension and refreshes stale conflict state through the API boundary', async () => {
    updateMembership.mockResolvedValue({ data: { ...clientMember, status: 'SUSPENDED' }, meta: {} });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AccessManagement organizationId="10000000-0000-4000-8000-000000000002" />
      </QueryClientProvider>,
    );
    await screen.findByText('Morgan Member');
    await user.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(updateMembership).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000002',
      clientMember.membershipId,
      {
        status: 'SUSPENDED',
        expectedUpdatedAt: clientMember.updatedAt,
      },
    );
    expect(await screen.findByText('Membership updated.')).toBeVisible();
  });
});
