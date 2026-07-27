import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError, requestsApi } from '../../api.js';
import { CommentSection } from '../comments/CommentSection.js';
import { EstimateSection } from '../estimates/EstimateSection.js';
export function ChangeRequestDetail() {
  const { changeRequestId = '' } = useParams();
  const location = useLocation();
  const created = Boolean((location.state as { created?: boolean } | null)?.created);
  const query = useQuery({
    queryKey: ['change-request', changeRequestId],
    queryFn: () => requestsApi.detail(changeRequestId),
  });
  if (query.isPending) return <p>Loading request…</p>;
  if (query.isError)
    return (
      <section className="card">
        <h1>Request unavailable</h1>
        <p className="error">
          {query.error instanceof ApiError && query.error.status === 403
            ? 'You do not have access to this request.'
            : 'This request was not found or is unavailable.'}
        </p>
        <Link to="/">Back to requests</Link>
      </section>
    );
  const request = query.data.data;
  return (
    <>
      <Link to={`/projects/${request.projectId}/change-requests`}>← All change requests</Link>
      {created && (
        <p className="notice" role="status">
          Change request submitted successfully.
        </p>
      )}
      <article className="card" style={{ marginTop: '20px' }}>
        <p className="eyebrow">
          {request.status.replaceAll('_', ' ')} · {request.priority} priority
        </p>
        <h1>{request.title}</h1>
        <p>{request.description}</p>
        <dl>
          <dt>Requested completion</dt>
          <dd>{request.requestedCompletionDate ?? 'Not specified'}</dd>
          <dt>Submitted</dt>
          <dd>{new Date(request.createdAt).toLocaleString()}</dd>
        </dl>
      </article>
      <EstimateSection changeRequestId={request.id} requestStatus={request.status} />
      <CommentSection key={request.id} changeRequestId={request.id} requestStatus={request.status} />
    </>
  );
}
