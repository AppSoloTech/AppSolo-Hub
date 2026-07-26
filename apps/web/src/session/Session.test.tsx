import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevelopmentSignIn } from './DevelopmentSignIn.js';
import { InvitationAcceptance } from './InvitationAcceptance.js';
import { SessionProvider } from './SessionProvider.js';

const { signIn, current, acceptInvitation } = vi.hoisted(() => ({
  signIn: vi.fn(),
  current: vi.fn(),
  acceptInvitation: vi.fn(),
}));

vi.mock('../api.js', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  developmentIdentityStorageKey: 'appsolo.developmentUserId',
  developmentSignedOutStorageKey: 'appsolo.developmentSignedOut',
  initializeDevelopmentUserId: () => null,
  storeDevelopmentUserId: (userId: string) =>
    window.localStorage.setItem('appsolo.developmentUserId', userId),
  clearDevelopmentUserId: () => window.localStorage.removeItem('appsolo.developmentUserId'),
  sessionApi: { signIn, current },
  accessApi: { acceptInvitation },
}));

const session = {
  user: {
    id: '20000000-0000-4000-8000-000000000003',
    email: 'admin@client.test',
    firstName: 'Casey',
    lastName: 'Admin',
  },
  memberships: [],
};

function renderWithSession(node: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <SessionProvider>{node}</SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  signIn.mockReset();
  current.mockReset();
  acceptInvitation.mockReset();
});

describe('development session UI', () => {
  it('labels local sign in as insecure and establishes identity by normalized email response', async () => {
    signIn.mockResolvedValue({ data: session, meta: {} });
    const user = userEvent.setup();
    renderWithSession(<DevelopmentSignIn />);
    expect(screen.getByText(/intentionally insecure/i)).toBeVisible();
    await user.type(screen.getByLabelText('Email'), 'ADMIN@CLIENT.TEST');
    await user.click(screen.getByRole('button', { name: 'Sign in locally' }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('ADMIN@CLIENT.TEST'));
    expect(window.localStorage.getItem('appsolo.developmentUserId')).toBe(session.user.id);
  });

  it('scrubs the fragment before accepting and never stores the invitation token', async () => {
    const token = 'sensitive-invitation-token-material-which-is-long-enough';
    acceptInvitation.mockResolvedValue({ data: session, meta: {} });
    window.history.replaceState({}, '', `/invitations/accept#token=${token}`);
    renderWithSession(<InvitationAcceptance />);
    expect(window.location.hash).toBe('');
    expect(await screen.findByRole('heading', { name: 'Invitation accepted' })).toBeVisible();
    expect(acceptInvitation).toHaveBeenCalledWith(token);
    expect(JSON.stringify(window.localStorage)).not.toContain(token);
  });

  it('renders explicit expired and invalid invitation states', async () => {
    const ApiError = (await import('../api.js')).ApiError;
    acceptInvitation.mockRejectedValue(new ApiError(410, 'INVITATION_EXPIRED', 'Expired'));
    window.history.replaceState({}, '', `/invitations/accept#token=${'x'.repeat(50)}`);
    renderWithSession(<InvitationAcceptance />);
    expect(await screen.findByRole('heading', { name: 'Invitation expired' })).toBeVisible();
  });
});
