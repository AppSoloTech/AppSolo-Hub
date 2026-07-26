import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CreateInvitationInput, MemberDto, OrganizationRole } from '@appsolo/shared';
import { accessApi, ApiError } from '../../api.js';
import { useSession } from '../../session/SessionProvider.js';
import styles from './AccessManagement.module.css';

const roleLabels: Record<OrganizationRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  DEVELOPER: 'Developer',
  CLIENT_ADMIN: 'Client administrator',
  CLIENT_MEMBER: 'Client member',
};
const roleCeiling: Record<OrganizationRole, OrganizationRole[]> = {
  OWNER: ['OWNER', 'ADMIN', 'DEVELOPER', 'CLIENT_ADMIN', 'CLIENT_MEMBER'],
  ADMIN: ['DEVELOPER', 'CLIENT_ADMIN', 'CLIENT_MEMBER'],
  CLIENT_ADMIN: ['CLIENT_MEMBER'],
  DEVELOPER: [],
  CLIENT_MEMBER: [],
};

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The access change could not be completed.';
}

export function AccessManagement({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const membership = session?.memberships.find((entry) => entry.organizationId === organizationId);
  const allowedRoles = membership
    ? roleCeiling[membership.role].filter(
        (role) =>
          membership.organizationType === 'CLIENT' ||
          role === 'OWNER' ||
          role === 'ADMIN' ||
          role === 'DEVELOPER',
      )
    : [];
  const membersQuery = useQuery({
    queryKey: ['members', organizationId],
    queryFn: () => accessApi.members(organizationId).then((response) => response.data),
  });
  const invitationsQuery = useQuery({
    queryKey: ['invitations', organizationId],
    queryFn: () => accessApi.invitations(organizationId).then((response) => response.data),
  });
  const eventsQuery = useQuery({
    queryKey: ['access-events', organizationId],
    queryFn: () => accessApi.events(organizationId).then((response) => response.data),
  });
  const [form, setForm] = useState<CreateInvitationInput>({
    firstName: '',
    lastName: '',
    email: '',
    role: allowedRoles[0] ?? 'CLIENT_MEMBER',
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [acceptanceUrl, setAcceptanceUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['members', organizationId] }),
      queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] }),
      queryClient.invalidateQueries({ queryKey: ['access-events', organizationId] }),
      queryClient.invalidateQueries({ queryKey: ['session'] }),
    ]);
  };
  const perform = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      setFeedback(success);
      await refresh();
    } catch (error: unknown) {
      setFeedback(errorMessage(error));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (membersQuery.isLoading || invitationsQuery.isLoading || eventsQuery.isLoading) {
    return <p>Loading access management…</p>;
  }
  const queryError = membersQuery.error ?? invitationsQuery.error ?? eventsQuery.error;
  if (queryError) {
    return (
      <p className="error" role="alert">
        {errorMessage(queryError)}
      </p>
    );
  }

  return (
    <div className={styles.page}>
      <header className="pageHeader">
        <div>
          <p className="eyebrow">{membership?.organizationName ?? 'Organization'}</p>
          <h1>Access management</h1>
          <p>Manage local invitations and active or suspended organization memberships.</p>
        </div>
      </header>

      {feedback ? (
        <p className="notice" role="status" tabIndex={-1}>
          {feedback}
        </p>
      ) : null}

      <section className="card" aria-labelledby="invite-heading">
        <h2 id="invite-heading">Invite a member</h2>
        <form
          className={styles.inviteForm}
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setFeedback(null);
            setAcceptanceUrl(null);
            void accessApi
              .createInvitation(organizationId, form)
              .then(async (response) => {
                setAcceptanceUrl(response.data.acceptanceUrl ?? null);
                setFeedback('Invitation created. Copy the local link before leaving this page.');
                setForm({ ...form, firstName: '', lastName: '', email: '' });
                await refresh();
              })
              .catch((error: unknown) => setFeedback(errorMessage(error)))
              .finally(() => setBusy(false));
          }}
        >
          <label>
            First name
            <input
              required
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
          </label>
          <label>
            Last name
            <input
              required
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as OrganizationRole })}
            >
              {allowedRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <button className="button" disabled={busy || allowedRoles.length === 0}>
            Create invitation
          </button>
        </form>
        {acceptanceUrl ? (
          <div className={styles.acceptanceLink}>
            <label htmlFor="acceptance-url">Local acceptance link</label>
            <input id="acceptance-url" readOnly value={acceptanceUrl} />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(acceptanceUrl)
                  .then(() => setFeedback('Local acceptance link copied.'))
                  .catch(() => setFeedback('Copy the selected link manually.'));
              }}
            >
              Copy link
            </button>
          </div>
        ) : null}
      </section>

      <section className="card" aria-labelledby="members-heading">
        <h2 id="members-heading">Members</h2>
        {membersQuery.data?.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {membersQuery.data.map((member) => (
                  <MemberRow
                    key={member.membershipId}
                    member={member}
                    actorUserId={session?.user.id ?? ''}
                    allowedRoles={allowedRoles}
                    busy={busy}
                    onChange={(change) => {
                      void perform(
                        () =>
                          accessApi.updateMembership(organizationId, member.membershipId, {
                            ...change,
                            expectedUpdatedAt: member.updatedAt,
                          }),
                        'Membership updated.',
                      );
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No members found.</p>
        )}
      </section>

      <section className="card" aria-labelledby="invitations-heading">
        <h2 id="invitations-heading">Invitations</h2>
        {invitationsQuery.data?.length ? (
          <ul className={styles.list}>
            {invitationsQuery.data.map((invitation) => (
              <li key={invitation.id}>
                <div>
                  <strong>
                    {invitation.firstName} {invitation.lastName}
                  </strong>
                  <span>{invitation.email}</span>
                  <span>
                    {roleLabels[invitation.role]} · {invitation.status.toLowerCase()}
                  </span>
                </div>
                {invitation.status === 'PENDING' || invitation.status === 'EXPIRED' ? (
                  <div className={styles.actions}>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        setFeedback(null);
                        setAcceptanceUrl(null);
                        void accessApi
                          .resendInvitation(organizationId, invitation.id)
                          .then(async (response) => {
                            setAcceptanceUrl(response.data.acceptanceUrl ?? null);
                            setFeedback('Invitation resent. The previous link is now invalid.');
                            await refresh();
                          })
                          .catch((error: unknown) => setFeedback(errorMessage(error)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      Resend
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        void perform(
                          () => accessApi.revokeInvitation(organizationId, invitation.id),
                          'Invitation revoked.',
                        );
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No invitations found.</p>
        )}
      </section>

      <section className="card" aria-labelledby="history-heading">
        <h2 id="history-heading">Access history</h2>
        {eventsQuery.data?.length ? (
          <ul className={styles.list}>
            {eventsQuery.data.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{event.eventType.replaceAll('_', ' ').toLowerCase()}</strong>
                  <span>{event.subjectName}</span>
                  <span>
                    {event.actorName ? `By ${event.actorName} · ` : ''}
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No access history yet.</p>
        )}
      </section>
    </div>
  );
}

function MemberRow({
  member,
  actorUserId,
  allowedRoles,
  busy,
  onChange,
}: {
  member: MemberDto;
  actorUserId: string;
  allowedRoles: OrganizationRole[];
  busy: boolean;
  onChange: (change: { role: OrganizationRole } | { status: 'ACTIVE' | 'SUSPENDED' }) => void;
}) {
  const manageable = allowedRoles.includes(member.role);
  return (
    <tr>
      <td>
        {member.firstName} {member.lastName}
      </td>
      <td>{member.email}</td>
      <td>
        {manageable ? (
          <select
            aria-label={`Role for ${member.firstName} ${member.lastName}`}
            value={member.role}
            disabled={busy}
            onChange={(event) => onChange({ role: event.target.value as OrganizationRole })}
          >
            {allowedRoles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        ) : (
          roleLabels[member.role]
        )}
      </td>
      <td>{member.status.toLowerCase()}</td>
      <td>
        {manageable ? (
          <button
            disabled={busy || (member.userId === actorUserId && member.status === 'ACTIVE')}
            onClick={() => onChange({ status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
          >
            {member.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
          </button>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}
