import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calculateEstimatedCost,
  createEstimateSchema,
  estimatedHoursSchema,
  hourlyRateSchema,
  respondToEstimateSchema,
  type ChangeRequestStatus,
  type CreateEstimateInput,
  type EstimateDto,
  type EstimateResponseCommand,
} from '@appsolo/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, estimatesApi } from '../../api.js';
import styles from './EstimateSection.module.css';

type Terms = { estimatedHours: string; hourlyRate: string; scopeNotes: string };
const emptyTerms: Terms = { estimatedHours: '', hourlyRate: '', scopeNotes: '' };
const draftableStatuses: ChangeRequestStatus[] = [
  'SUBMITTED',
  'AWAITING_ESTIMATE',
  'REJECTED',
  'NEEDS_CLARIFICATION',
];

const statusLabel = (status: EstimateDto['status']): string => {
  if (status === 'NEEDS_CLARIFICATION') return 'Clarification requested';
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ');
};

const usd = (value: string): string => {
  const [integer = '0', fraction = '00'] = value.split('.');
  return `$${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
};

const issueMap = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]));

const errorText = (error: unknown): string =>
  error instanceof ApiError && error.status === 409
    ? 'This estimate changed or is no longer actionable. The latest state has been loaded.'
    : error instanceof ApiError
      ? error.message
      : 'The estimate action could not be completed.';

export function EstimateSection({
  changeRequestId,
  requestStatus,
}: {
  changeRequestId: string;
  requestStatus: ChangeRequestStatus;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['estimates', changeRequestId],
    queryFn: () => estimatesApi.list(changeRequestId),
  });
  const estimates = query.data?.data ?? [];
  const draft = estimates.find((estimate) => estimate.status === 'DRAFT');
  const actionable = estimates.find((estimate) => estimate.status === 'SUBMITTED');
  const [terms, setTerms] = useState<Terms>(emptyTerms);
  const [termErrors, setTermErrors] = useState<Record<string, string>>({});
  const [decisionNote, setDecisionNote] = useState('');
  const [responseError, setResponseError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setTerms(
      draft
        ? {
            estimatedHours: draft.estimatedHours,
            hourlyRate: draft.hourlyRate,
            scopeNotes: draft.scopeNotes,
          }
        : emptyTerms,
    );
  }, [draft?.id]);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const preview = useMemo(() => {
    try {
      const hours = estimatedHoursSchema.parse(terms.estimatedHours);
      const rate = hourlyRateSchema.parse(terms.hourlyRate);
      return usd(calculateEstimatedCost(hours, rate));
    } catch {
      return '—';
    }
  }, [terms]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['estimates', changeRequestId] }),
      queryClient.invalidateQueries({ queryKey: ['change-request', changeRequestId] }),
      queryClient.invalidateQueries({ queryKey: ['change-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['session'] }),
    ]);
  };

  const perform = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      setFeedback(success);
    } catch (error: unknown) {
      setFeedback(errorText(error));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    const parsed = createEstimateSchema.safeParse(terms);
    if (!parsed.success) {
      setTermErrors(issueMap(parsed.error.issues));
      return;
    }
    setTermErrors({});
    const input: CreateEstimateInput = parsed.data;
    await perform(
      () =>
        draft
          ? estimatesApi.update(draft.id, { ...input, expectedUpdatedAt: draft.updatedAt })
          : estimatesApi.create(changeRequestId, input),
      draft ? 'Draft estimate updated.' : 'Draft estimate created.',
    );
  };

  const respond = async (decision: EstimateResponseCommand) => {
    if (!actionable) return;
    const parsed = respondToEstimateSchema.safeParse({
      decision,
      note: decision === 'APPROVE' ? decisionNote || undefined : decisionNote,
      expectedUpdatedAt: actionable.updatedAt,
    });
    if (!parsed.success) {
      setResponseError(parsed.error.issues[0]?.message ?? 'Check the response note.');
      return;
    }
    setResponseError(null);
    await perform(
      () => estimatesApi.respond(actionable.id, parsed.data),
      decision === 'APPROVE'
        ? 'Estimate approved.'
        : decision === 'REJECT'
          ? 'Estimate rejected.'
          : 'Clarification requested.',
    );
    setDecisionNote('');
  };

  if (query.isPending) return <p>Loading estimates…</p>;
  if (query.isError)
    return (
      <section className="card" aria-labelledby="estimates-heading">
        <h2 id="estimates-heading">Estimates</h2>
        <p className="error" role="alert">
          Estimates are unavailable.
        </p>
      </section>
    );

  const canManage = query.data.meta.canManage;
  const canRespond = query.data.meta.canRespond;
  const showDraftForm = canManage && (Boolean(draft) || draftableStatuses.includes(requestStatus));

  return (
    <section className={styles.section} aria-labelledby="estimates-heading">
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Exact USD terms</p>
          <h2 id="estimates-heading">Estimates</h2>
        </div>
        <span>
          {estimates.length} version{estimates.length === 1 ? '' : 's'}
        </span>
      </div>

      {feedback ? (
        <p className="notice" role="status" tabIndex={-1} ref={feedbackRef}>
          {feedback}
        </p>
      ) : null}

      {showDraftForm ? (
        <form
          className={`card ${styles.form}`}
          aria-label={draft ? `Edit estimate version ${draft.version}` : 'Create estimate draft'}
          onSubmit={(event) => {
            event.preventDefault();
            void saveDraft();
          }}
          noValidate
        >
          <div>
            <p className="eyebrow">{draft ? `Draft · Version ${draft.version}` : 'New draft'}</p>
            <h3>{draft ? 'Edit draft estimate' : 'Prepare an estimate'}</h3>
            <p>Hours, rate, and scope become immutable after submission.</p>
          </div>
          <div className={styles.termGrid}>
            <label>
              Estimated hours
              <input
                inputMode="decimal"
                value={terms.estimatedHours}
                aria-invalid={Boolean(termErrors.estimatedHours)}
                onChange={(event) => setTerms({ ...terms, estimatedHours: event.target.value })}
              />
              {termErrors.estimatedHours ? <span className="error">{termErrors.estimatedHours}</span> : null}
            </label>
            <label>
              Hourly rate (USD)
              <input
                inputMode="decimal"
                value={terms.hourlyRate}
                aria-invalid={Boolean(termErrors.hourlyRate)}
                onChange={(event) => setTerms({ ...terms, hourlyRate: event.target.value })}
              />
              {termErrors.hourlyRate ? <span className="error">{termErrors.hourlyRate}</span> : null}
            </label>
            <label>
              Estimated cost (server-derived)
              <output className={styles.cost} aria-live="polite">
                {preview}
              </output>
            </label>
          </div>
          <label>
            Scope notes
            <textarea
              rows={6}
              value={terms.scopeNotes}
              aria-invalid={Boolean(termErrors.scopeNotes)}
              onChange={(event) => setTerms({ ...terms, scopeNotes: event.target.value })}
            />
            {termErrors.scopeNotes ? <span className="error">{termErrors.scopeNotes}</span> : null}
          </label>
          <div className={styles.actions}>
            <button className="button" disabled={busy}>
              {busy ? 'Saving…' : draft ? 'Save draft' : 'Create draft'}
            </button>
            {draft ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void perform(
                    () => estimatesApi.submit(draft.id, draft.updatedAt),
                    'Estimate submitted for client approval.',
                  );
                }}
              >
                Submit for approval
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {canRespond && actionable ? (
        <form
          className={`card ${styles.responseForm}`}
          aria-label={`Respond to estimate version ${actionable.version}`}
          onSubmit={(event) => event.preventDefault()}
        >
          <div>
            <p className="eyebrow">Client administrator decision</p>
            <h3>Respond to version {actionable.version}</h3>
          </div>
          <div>
            <label htmlFor="estimate-decision-note">Decision note</label>
            <textarea
              id="estimate-decision-note"
              rows={4}
              value={decisionNote}
              aria-invalid={Boolean(responseError)}
              aria-describedby="estimate-decision-note-help"
              onChange={(event) => setDecisionNote(event.target.value)}
            />
            <span id="estimate-decision-note-help">
              Optional for approval; required for rejection or clarification.
            </span>
          </div>
          {responseError ? (
            <p className="error" role="alert">
              {responseError}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button className="button" type="button" disabled={busy} onClick={() => void respond('APPROVE')}>
              Approve estimate
            </button>
            <button type="button" disabled={busy} onClick={() => void respond('REJECT')}>
              Reject estimate
            </button>
            <button type="button" disabled={busy} onClick={() => void respond('REQUEST_CLARIFICATION')}>
              Request clarification
            </button>
          </div>
        </form>
      ) : null}

      <div className={styles.history} aria-label="Estimate version history">
        {estimates.length === 0 ? (
          <div className="card">
            <h3>No submitted estimates yet</h3>
            <p>
              {canManage
                ? 'Create a draft when the request is ready to scope.'
                : 'Submitted terms will appear here.'}
            </p>
          </div>
        ) : (
          estimates.map((estimate) => (
            <article className="card" key={estimate.id}>
              <div className={styles.versionHeader}>
                <div>
                  <p className="eyebrow">Version {estimate.version}</p>
                  <h3>{statusLabel(estimate.status)}</h3>
                </div>
                <strong>{usd(estimate.estimatedCost)}</strong>
              </div>
              <dl className={styles.terms}>
                <div>
                  <dt>Estimated hours</dt>
                  <dd>{estimate.estimatedHours}</dd>
                </div>
                <div>
                  <dt>Hourly rate</dt>
                  <dd>{usd(estimate.hourlyRate)}</dd>
                </div>
                <div>
                  <dt>Prepared by</dt>
                  <dd>{estimate.creatorDisplayName}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>
                    {estimate.submittedAt ? new Date(estimate.submittedAt).toLocaleString() : 'Not submitted'}
                  </dd>
                </div>
              </dl>
              <h4>Scope</h4>
              <p className={styles.scope}>{estimate.scopeNotes}</p>
              {estimate.response ? (
                <div className={styles.response}>
                  <strong>
                    {statusLabel(estimate.status)} by {estimate.response.actorDisplayName}
                  </strong>
                  {estimate.response.note ? <p>{estimate.response.note}</p> : null}
                  <span>{new Date(estimate.response.createdAt).toLocaleString()}</span>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
