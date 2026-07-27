import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { seededProjectId } from '../app/App.js';
import { useSession } from '../session/SessionProvider.js';
import { getAppliedTheme, saveTheme } from '../theme.js';
import styles from './DashboardLayout.module.css';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useSession();
  const location = useLocation();
  const [theme, setTheme] = useState(getAppliedTheme);
  const accessMemberships =
    session?.memberships.filter((membership) => membership.capabilities.includes('VIEW_MEMBERS')) ?? [];
  const organizationRouteMatch = /^\/organizations\/([^/]+)\/access(?:\/|$)/.exec(location.pathname);
  const routeOrganization = session?.memberships.find(
    (membership) => membership.organizationId === organizationRouteMatch?.[1],
  );
  const organizationLabel =
    routeOrganization?.organizationName ??
    (session?.memberships.length === 1
      ? session.memberships[0]?.organizationName
      : session && session.memberships.length > 1
        ? 'Multiple authorized organizations'
        : 'Authorized workspace');
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          AppSolo <span>Client Hub</span>
        </div>
        <button
          type="button"
          className={styles.themeToggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={() => {
            const nextTheme = theme === 'dark' ? 'light' : 'dark';
            saveTheme(nextTheme);
            setTheme(nextTheme);
          }}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <p className={styles.org}>{organizationLabel}</p>
        <nav>
          <Link to={`/projects/${seededProjectId}/change-requests`}>Change requests</Link>
          {accessMemberships.map((membership) => (
            <Link key={membership.id} to={`/organizations/${membership.organizationId}/access`}>
              Access · {membership.organizationName}
            </Link>
          ))}
        </nav>
        <div className={styles.user}>
          <strong>
            {session?.user.firstName} {session?.user.lastName}
          </strong>
          <span>{session?.user.email}</span>
          <span>Development identity</span>
          <button onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
