import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { accessApi, ApiError } from '../api.js';
import { useSession } from './SessionProvider.js';
import styles from './Session.module.css';

type AcceptanceState = 'accepting' | 'success' | 'expired' | 'invalid' | 'error';
type AcceptanceResult = Awaited<ReturnType<typeof accessApi.acceptInvitation>>;
type AcceptanceAttempt = {
  token: string | null;
  promise: Promise<AcceptanceResult> | null;
};

let activeAttempt: AcceptanceAttempt | null = null;

const initializeAttempt = (): AcceptanceAttempt => {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const fragmentToken = fragment.get('token');
  if (fragmentToken !== null || activeAttempt === null) {
    activeAttempt = { token: fragmentToken, promise: null };
  }
  window.history.replaceState(
    window.history.state,
    document.title,
    `${window.location.pathname}${window.location.search}`,
  );
  return activeAttempt;
};

export function InvitationAcceptance() {
  const { establish } = useSession();
  const attemptRef = useRef<AcceptanceAttempt | null>(null);
  const startedRef = useRef(false);
  const [state, setState] = useState<AcceptanceState>('accepting');

  if (attemptRef.current === null) attemptRef.current = initializeAttempt();

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const attempt = attemptRef.current;
    if (attempt === null || (attempt.token === null && attempt.promise === null)) {
      setState('invalid');
      return;
    }
    if (attempt.promise === null && attempt.token !== null) {
      attempt.promise = accessApi.acceptInvitation(attempt.token);
      attempt.token = null;
    }
    if (attempt.promise === null) return;
    void attempt.promise
      .then((response) => {
        establish(response.data);
        setState('success');
      })
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.code === 'INVITATION_EXPIRED') {
          setState('expired');
        } else if (reason instanceof ApiError && reason.code === 'INVITATION_INVALID') {
          setState('invalid');
        } else {
          setState('error');
        }
      })
      .finally(() => {
        window.setTimeout(() => {
          if (activeAttempt === attempt) activeAttempt = null;
        }, 0);
      });
  }, [establish]);

  const content = {
    accepting: ['Accepting invitation…', 'Please wait while the local invitation is verified.'],
    success: ['Invitation accepted', 'Your local development session is ready.'],
    expired: ['Invitation expired', 'Ask an organization administrator to resend this invitation.'],
    invalid: ['Invitation invalid', 'This link is invalid, revoked, rotated, or was already used.'],
    error: [
      'Unable to accept invitation',
      'A retryable error occurred. Reopen the original link to try again.',
    ],
  }[state];

  return (
    <main className={styles.centered}>
      <section className={`card ${styles.signIn}`} aria-live="polite">
        <p className="eyebrow">Local access invitation</p>
        <h1>{content[0]}</h1>
        <p>{content[1]}</p>
        {state === 'success' ? <Link to="/">Continue to Client Hub</Link> : null}
      </section>
    </main>
  );
}
