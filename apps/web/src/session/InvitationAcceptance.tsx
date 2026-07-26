import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { accessApi, ApiError } from '../api.js';
import { useSession } from './SessionProvider.js';
import styles from './Session.module.css';

type AcceptanceState = 'accepting' | 'success' | 'expired' | 'invalid' | 'error';

export function InvitationAcceptance() {
  const { establish } = useSession();
  const tokenRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const startedRef = useRef(false);
  const [state, setState] = useState<AcceptanceState>('accepting');

  if (!initializedRef.current) {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    tokenRef.current = fragment.get('token');
    window.history.replaceState(
      window.history.state,
      document.title,
      `${window.location.pathname}${window.location.search}`,
    );
    initializedRef.current = true;
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const token = tokenRef.current;
    tokenRef.current = null;
    if (!token) {
      setState('invalid');
      return;
    }
    void accessApi
      .acceptInvitation(token)
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
