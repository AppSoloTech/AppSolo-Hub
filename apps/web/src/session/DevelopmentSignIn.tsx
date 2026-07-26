import { useState } from 'react';
import { ApiError } from '../api.js';
import { useSession } from './SessionProvider.js';
import styles from './Session.module.css';

export function DevelopmentSignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className={styles.centered}>
      <section className={`card ${styles.signIn}`} aria-labelledby="sign-in-title">
        <p className="eyebrow">Local development only</p>
        <h1 id="sign-in-title">Development sign in</h1>
        <p>
          This email-only identity selector is intentionally insecure and is not production authentication.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitting(true);
            setError(null);
            void signIn(email)
              .catch((reason: unknown) =>
                setError(
                  reason instanceof ApiError ? reason.message : 'Development sign in could not be completed.',
                ),
              )
              .finally(() => setSubmitting(false));
          }}
        >
          <label htmlFor="development-email">Email</label>
          <input
            id="development-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in locally'}
          </button>
        </form>
      </section>
    </main>
  );
}
