import { Link } from 'react-router-dom';
import { seededProjectId } from '../app/App.js';
import styles from './DashboardLayout.module.css';
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          AppSolo <span>Client Hub</span>
        </div>
        <p className={styles.org}>Authorized workspace</p>
        <nav>
          <Link to={`/projects/${seededProjectId}/change-requests`}>Change requests</Link>
        </nav>
        <p className={styles.user}>Development identity</p>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
