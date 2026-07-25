import { Navigate, Route, Routes } from 'react-router-dom';
import { ChangeRequestDetail } from '../features/change-requests/ChangeRequestDetail.js';
import { ChangeRequestList } from '../features/change-requests/ChangeRequestList.js';
import { NewChangeRequest } from '../features/change-requests/NewChangeRequest.js';
import { DashboardLayout } from '../layouts/DashboardLayout.js';
export const seededProjectId = '10000000-0000-4000-8000-000000000003';
export function App() { return <DashboardLayout><Routes><Route path="/projects/:projectId/change-requests" element={<ChangeRequestList />} /><Route path="/change-requests/:changeRequestId" element={<ChangeRequestDetail />} /><Route path="/projects/:projectId/change-requests/new" element={<NewChangeRequest />} /><Route path="*" element={<Navigate to={`/projects/${seededProjectId}/change-requests`} replace />} /></Routes></DashboardLayout>; }
