import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AccessManagement } from '../features/access/AccessManagement.js';
import { ChangeRequestDetail } from '../features/change-requests/ChangeRequestDetail.js';
import { ChangeRequestList } from '../features/change-requests/ChangeRequestList.js';
import { NewChangeRequest } from '../features/change-requests/NewChangeRequest.js';
import { DashboardLayout } from '../layouts/DashboardLayout.js';
import { DevelopmentSignIn } from '../session/DevelopmentSignIn.js';
import { InvitationAcceptance } from '../session/InvitationAcceptance.js';
import { useSession } from '../session/SessionProvider.js';
export const seededProjectId = '10000000-0000-4000-8000-000000000003';

function AccessRoute() {
  const { organizationId } = useParams();
  return organizationId ? <AccessManagement organizationId={organizationId} /> : <Navigate to="/" replace />;
}

function AuthenticatedApplication() {
  const { session, loading, error, signOut } = useSession();
  if (loading) return <main className="loadingPage">Loading development session…</main>;
  if (!session && error) {
    return (
      <main className="loadingPage">
        <p className="error" role="alert">
          {error}
        </p>
        <button className="button" onClick={signOut}>
          Return to development sign in
        </button>
      </main>
    );
  }
  if (!session) return <DevelopmentSignIn />;
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/projects/:projectId/change-requests" element={<ChangeRequestList />} />
        <Route path="/change-requests/:changeRequestId" element={<ChangeRequestDetail />} />
        <Route path="/projects/:projectId/change-requests/new" element={<NewChangeRequest />} />
        <Route path="/organizations/:organizationId/access" element={<AccessRoute />} />
        <Route path="*" element={<Navigate to={`/projects/${seededProjectId}/change-requests`} replace />} />
      </Routes>
    </DashboardLayout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/invitations/accept" element={<InvitationAcceptance />} />
      <Route path="*" element={<AuthenticatedApplication />} />
    </Routes>
  );
}
