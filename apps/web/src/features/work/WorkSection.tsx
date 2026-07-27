import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelChangeRequestSchema,
  createReviewHandoffSchema,
  createTimeEntrySchema,
  respondToReviewHandoffSchema,
  voidTimeEntrySchema,
  type ChangeRequestDto,
  type RequestHistoryItem,
  type ReviewHandoffDto,
  type TimeEntryDto,
} from '@appsolo/shared';
import { useEffect, useRef, useState } from 'react';
import { ApiError, currentDevelopmentUserId, workApi } from '../../api.js';
import styles from './WorkSection.module.css';

const HISTORY_PAGE_SIZE = 10;
const TIME_PAGE_SIZE = 5;
type Feedback = { kind: 'success' | 'error'; message: string };

const errorText = (error: unknown): string =>
  error instanceof ApiError && error.status === 409
    ? 'This request changed or is no longer actionable. The latest state is shown—review it before trying again.'
    : error instanceof ApiError
      ? error.message
      : 'The action could not be completed. Your input has been preserved.';

const issueMap = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]));

const minutesLabel = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
};

function HandoffCard({ handoff }: { handoff: ReviewHandoffDto }) {
  return (
    <article className={`card ${styles.handoff}`}>
      <div className={styles.itemHeader}>
        <div>
          <p className="eyebrow">Review handoff · Version {handoff.version}</p>
          <h3>Delivery summary</h3>
        </div>
        <time dateTime={handoff.createdAt}>{new Date(handoff.createdAt).toLocaleString()}</time>
      </div>
      <p>{handoff.workSummary}</p>
      {handoff.releaseNotes ? (
        <>
          <h4>Release notes</h4>
          <p>{handoff.releaseNotes}</p>
        </>
      ) : null}
      <p className={styles.attribution}>Prepared by {handoff.actorDisplayName}</p>
      {handoff.response ? (
        <div className={styles.response}>
          <strong>{handoff.response.decision === 'ACCEPTED' ? 'Accepted' : 'Changes requested'}</strong>
          {handoff.response.note ? <p>{handoff.response.note}</p> : null}
          <span>
            {handoff.response.actorDisplayName} · {new Date(handoff.response.createdAt).toLocaleString()}
          </span>
        </div>
      ) : (
        <p className={styles.pending}>Awaiting client administrator response.</p>
      )}
    </article>
  );
}

function TimeSection({ request }: { request: ChangeRequestDto }) {
  const queryClient = useQueryClient();
  const identity = currentDevelopmentUserId();
  const [offset, setOffset] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const query = useQuery({
    queryKey: ['time-entries', identity, request.id, offset],
    queryFn: () => workApi.timeEntries(request.id, TIME_PAGE_SIZE + 1, offset),
  });

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['time-entries', identity, request.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['history', identity, request.id],
      }),
    ]);
  };

  const create = async () => {
    const parsed = createTimeEntrySchema.safeParse({
      durationMinutes: Number(durationMinutes),
      description,
      workDate,
    });
    if (!parsed.success) {
      setErrors(issueMap(parsed.error.issues));
      return;
    }
    setErrors({});
    setFeedback(null);
    setBusy(true);
    try {
      await workApi.createTimeEntry(request.id, parsed.data);
      setDurationMinutes('');
      setDescription('');
      setWorkDate('');
      setOffset(0);
      await refresh();
      setFeedback({ kind: 'success', message: 'Private time entry recorded.' });
    } catch (error: unknown) {
      setFeedback({ kind: 'error', message: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const voidEntry = async (entry: TimeEntryDto) => {
    const parsed = voidTimeEntrySchema.safeParse({
      reason: voidReason,
      expectedUpdatedAt: entry.updatedAt,
    });
    if (!parsed.success) {
      setFeedback({
        kind: 'error',
        message: parsed.error.issues[0]?.message ?? 'Check the void reason.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await workApi.voidTimeEntry(entry.id, parsed.data);
      setVoidTarget(null);
      setVoidReason('');
      await refresh();
      setFeedback({
        kind: 'success',
        message: 'Time entry voided; its original record is retained.',
      });
    } catch (error: unknown) {
      setFeedback({ kind: 'error', message: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  if (query.isPending) {
    return (
      <section className={styles.section} aria-labelledby="private-time-heading">
        <h2 id="private-time-heading">Private time</h2>
        <p>Loading private time…</p>
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className={styles.section} aria-labelledby="private-time-heading">
        <h2 id="private-time-heading">Private time</h2>
        <p className="error" role="alert">
          Private time is unavailable.
        </p>
      </section>
    );
  }

  const { meta } = query.data;
  const entries = query.data.data.slice(0, TIME_PAGE_SIZE);
  const hasPrevious = offset > 0;
  const hasNext = query.data.data.length > TIME_PAGE_SIZE;
  const canVoid = (entry: TimeEntryDto) =>
    entry.voidedAt === null &&
    (meta.canManage || (meta.canVoidOwn && entry.authorUserId === currentDevelopmentUserId()));

  return (
    <section className={styles.section} aria-labelledby="private-time-heading">
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Internal only</p>
          <h2 id="private-time-heading">Private time</h2>
        </div>
        <strong>{minutesLabel(meta.activeDurationMinutes)} active</strong>
      </div>
      <p className={styles.privateNotice}>
        Time is private operational history. It is not billing or client-visible.
      </p>
      <div className={styles.feed} aria-label="Private time entries">
        {entries.length === 0 ? (
          <div className="card">
            <h3>No private time on this page</h3>
            <p>Record work only while this request is in progress.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <article
              key={entry.id}
              className={`card ${styles.timeEntry} ${entry.voidedAt ? styles.voided : ''}`}
            >
              <div className={styles.itemHeader}>
                <div>
                  <strong>{minutesLabel(entry.durationMinutes)}</strong>
                  <span>{entry.workDate}</span>
                </div>
                <span>{entry.authorDisplayName}</span>
              </div>
              <p>{entry.description}</p>
              {entry.voidedAt ? (
                <div className={styles.response}>
                  <strong>Voided</strong>
                  <p>{entry.voidReason}</p>
                  <span>
                    {entry.voidedByDisplayName} · {new Date(entry.voidedAt).toLocaleString()}
                  </span>
                </div>
              ) : canVoid(entry) ? (
                voidTarget === entry.id ? (
                  <form
                    className={styles.inlineForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void voidEntry(entry);
                    }}
                  >
                    <label htmlFor={`void-reason-${entry.id}`}>Void reason</label>
                    <textarea
                      id={`void-reason-${entry.id}`}
                      rows={3}
                      value={voidReason}
                      onChange={(event) => setVoidReason(event.target.value)}
                    />
                    <div className={styles.actions}>
                      <button className="button" disabled={busy}>
                        Confirm void
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setVoidTarget(null);
                          setVoidReason('');
                        }}
                      >
                        Keep entry
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setVoidTarget(entry.id);
                      setVoidReason('');
                    }}
                  >
                    Void entry
                  </button>
                )
              ) : null}
            </article>
          ))
        )}
      </div>
      {(hasPrevious || hasNext) && (
        <nav className={styles.pagination} aria-label="Private time pages">
          <button
            type="button"
            disabled={!hasPrevious || query.isFetching}
            onClick={() => setOffset(Math.max(0, offset - TIME_PAGE_SIZE))}
          >
            Newer entries
          </button>
          <span>
            Entries {offset + 1}–{offset + entries.length}
          </span>
          <button
            type="button"
            disabled={!hasNext || query.isFetching}
            onClick={() => setOffset(offset + TIME_PAGE_SIZE)}
          >
            Older entries
          </button>
        </nav>
      )}
      {feedback ? (
        <p
          className={feedback.kind === 'success' ? 'notice' : 'error'}
          role={feedback.kind === 'success' ? 'status' : 'alert'}
          tabIndex={-1}
          ref={feedbackRef}
        >
          {feedback.message}
        </p>
      ) : null}
      {meta.canCreate && request.status === 'IN_PROGRESS' ? (
        <form
          className={`card ${styles.form}`}
          aria-label="Record private time"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
          noValidate
        >
          <h3>Record private time</h3>
          <div className={styles.fieldGrid}>
            <label>
              Duration in minutes
              <input
                inputMode="numeric"
                value={durationMinutes}
                aria-invalid={Boolean(errors.durationMinutes)}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
              {errors.durationMinutes ? (
                <span className="error" role="alert">
                  {errors.durationMinutes}
                </span>
              ) : null}
            </label>
            <label>
              Work date
              <input
                type="date"
                value={workDate}
                aria-invalid={Boolean(errors.workDate)}
                onChange={(event) => setWorkDate(event.target.value)}
              />
              {errors.workDate ? (
                <span className="error" role="alert">
                  {errors.workDate}
                </span>
              ) : null}
            </label>
          </div>
          <label>
            Work description
            <textarea
              rows={4}
              maxLength={2000}
              value={description}
              aria-invalid={Boolean(errors.description)}
              onChange={(event) => setDescription(event.target.value)}
            />
            {errors.description ? (
              <span className="error" role="alert">
                {errors.description}
              </span>
            ) : null}
          </label>
          <button className="button" disabled={busy}>
            {busy ? 'Recording…' : 'Record time'}
          </button>
        </form>
      ) : null}
    </section>
  );
}

const historyTitle = (item: RequestHistoryItem): string => {
  switch (item.kind) {
    case 'STATUS_CHANGED':
      return `Status: ${item.newStatus.replaceAll('_', ' ')}`;
    case 'ESTIMATE_SUBMITTED':
      return `Estimate version ${item.version} submitted`;
    case 'ESTIMATE_RESPONDED':
      return `Estimate version ${item.version}: ${item.decision.replaceAll('_', ' ')}`;
    case 'COMMENT':
      return 'Comment added';
    case 'TIME_CREATED':
      return 'Private time recorded';
    case 'TIME_VOIDED':
      return 'Private time voided';
    case 'WORK_HANDOFF':
      return `Review handoff version ${item.version}`;
    case 'WORK_REVIEW_RESPONSE':
      return `Review version ${item.handoffVersion}: ${item.decision.replaceAll('_', ' ')}`;
  }
};

function HistoryContent({ item }: { item: RequestHistoryItem }) {
  switch (item.kind) {
    case 'STATUS_CHANGED':
      return item.note ? <p>{item.note}</p> : null;
    case 'ESTIMATE_SUBMITTED':
      return (
        <>
          <p>{item.scopeNotes}</p>
          <span>
            {item.estimatedHours} hours · ${item.hourlyRate}/hour · ${item.estimatedCost}
          </span>
        </>
      );
    case 'ESTIMATE_RESPONDED':
      return item.note ? <p>{item.note}</p> : null;
    case 'COMMENT':
      return (
        <>
          <span className={styles.visibility}>
            {item.visibility === 'INTERNAL_ONLY' ? 'Internal only' : 'Shared with client'}
          </span>
          <p>{item.body}</p>
        </>
      );
    case 'TIME_CREATED':
      return (
        <>
          <span className={styles.visibility}>Internal only</span>
          <p>{item.description}</p>
          <span>
            {minutesLabel(item.durationMinutes)} · {item.workDate}
          </span>
        </>
      );
    case 'TIME_VOIDED':
      return (
        <>
          <span className={styles.visibility}>Internal only</span>
          <p>{item.reason}</p>
        </>
      );
    case 'WORK_HANDOFF':
      return (
        <>
          <p>{item.workSummary}</p>
          {item.releaseNotes ? <p>{item.releaseNotes}</p> : null}
        </>
      );
    case 'WORK_REVIEW_RESPONSE':
      return item.note ? <p>{item.note}</p> : null;
  }
}

export function WorkSection({ request }: { request: ChangeRequestDto }) {
  const queryClient = useQueryClient();
  const identity = currentDevelopmentUserId();
  const [historyOffset, setHistoryOffset] = useState(0);
  const [summary, setSummary] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [handoffErrors, setHandoffErrors] = useState<Record<string, string>>({});
  const [reviewDecision, setReviewDecision] = useState<'ACCEPT' | 'REQUEST_CHANGES'>('ACCEPT');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const historyQuery = useQuery({
    queryKey: ['history', identity, request.id, historyOffset],
    queryFn: () => workApi.history(request.id, HISTORY_PAGE_SIZE + 1, historyOffset),
  });

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['change-request', request.id],
      }),
      queryClient.invalidateQueries({ queryKey: ['change-requests'] }),
      queryClient.invalidateQueries({
        queryKey: ['history', identity, request.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['time-entries', identity, request.id],
      }),
      queryClient.invalidateQueries({ queryKey: ['estimates', request.id] }),
    ]);
  };

  const perform = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      await refresh();
      setFeedback({ kind: 'success', message: success });
      return true;
    } catch (error: unknown) {
      setFeedback({ kind: 'error', message: errorText(error) });
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (historyQuery.isPending) {
    return (
      <section className={styles.section} aria-labelledby="work-heading">
        <h2 id="work-heading">Work and delivery</h2>
        <p>Loading work history…</p>
      </section>
    );
  }
  if (historyQuery.isError) {
    return (
      <section className={styles.section} aria-labelledby="work-heading">
        <h2 id="work-heading">Work and delivery</h2>
        <p className="error" role="alert">
          Work history is unavailable.
        </p>
      </section>
    );
  }

  const { meta } = historyQuery.data;
  const history = historyQuery.data.data.slice(0, HISTORY_PAGE_SIZE);
  const hasPreviousHistory = historyOffset > 0;
  const hasNextHistory = historyQuery.data.data.length > HISTORY_PAGE_SIZE;
  const currentHandoff = meta.currentHandoff;
  const cancellable = [
    'SUBMITTED',
    'AWAITING_ESTIMATE',
    'AWAITING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'NEEDS_CLARIFICATION',
    'IN_PROGRESS',
    'READY_FOR_REVIEW',
  ].includes(request.status);

  const submitHandoff = async () => {
    const parsed = createReviewHandoffSchema.safeParse({
      workSummary: summary,
      releaseNotes: releaseNotes || undefined,
      expectedUpdatedAt: request.updatedAt,
    });
    if (!parsed.success) {
      setHandoffErrors(issueMap(parsed.error.issues));
      return;
    }
    setHandoffErrors({});
    if (await perform(() => workApi.createHandoff(request.id, parsed.data), 'Review handoff created.')) {
      setSummary('');
      setReleaseNotes('');
    }
  };

  const respond = async () => {
    if (!currentHandoff) return;
    const parsed = respondToReviewHandoffSchema.safeParse({
      decision: reviewDecision,
      note: reviewNote || undefined,
      expectedUpdatedAt: request.updatedAt,
    });
    if (!parsed.success) {
      setReviewError(parsed.error.issues[0]?.message ?? 'Check the review note.');
      return;
    }
    setReviewError(null);
    if (
      await perform(
        () => workApi.respond(currentHandoff.id, parsed.data),
        reviewDecision === 'ACCEPT'
          ? 'Delivery accepted and request completed.'
          : 'Changes requested; work returned to in progress.',
      )
    ) {
      setReviewNote('');
    }
  };

  const cancel = async () => {
    if (!cancelConfirmed) {
      setCancelError('Confirm that you want to cancel this request.');
      return;
    }
    const parsed = cancelChangeRequestSchema.safeParse({
      reason: cancelReason,
      expectedUpdatedAt: request.updatedAt,
    });
    if (!parsed.success) {
      setCancelError(parsed.error.issues[0]?.message ?? 'Check the reason.');
      return;
    }
    setCancelError(null);
    if (
      await perform(() => workApi.cancel(request.id, parsed.data), 'Request cancelled with retained history.')
    ) {
      setCancelReason('');
      setCancelConfirmed(false);
    }
  };

  return (
    <>
      <section className={styles.section} aria-labelledby="work-heading">
        <div className={styles.heading}>
          <div>
            <p className="eyebrow">Controlled delivery workflow</p>
            <h2 id="work-heading">Work and delivery</h2>
          </div>
          <strong>{request.status.replaceAll('_', ' ')}</strong>
        </div>
        {feedback ? (
          <p
            className={feedback.kind === 'success' ? 'notice' : 'error'}
            role={feedback.kind === 'success' ? 'status' : 'alert'}
            tabIndex={-1}
            ref={feedbackRef}
          >
            {feedback.message}
          </p>
        ) : null}

        {meta.canManageWork && request.status === 'APPROVED' ? (
          <div className="card">
            <h3>Approved and ready to begin</h3>
            <p>Starting work creates one durable status-history event.</p>
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                void perform(() => workApi.start(request.id, request.updatedAt), 'Work started.');
              }}
            >
              {busy ? 'Starting…' : 'Start work'}
            </button>
          </div>
        ) : null}

        {meta.canManageWork && request.status === 'IN_PROGRESS' ? (
          <form
            className={`card ${styles.form}`}
            aria-label="Create review handoff"
            onSubmit={(event) => {
              event.preventDefault();
              void submitHandoff();
            }}
            noValidate
          >
            <h3>Prepare client review</h3>
            <label>
              Work summary
              <textarea
                rows={5}
                maxLength={5000}
                value={summary}
                aria-invalid={Boolean(handoffErrors.workSummary)}
                onChange={(event) => setSummary(event.target.value)}
              />
              {handoffErrors.workSummary ? (
                <span className="error" role="alert">
                  {handoffErrors.workSummary}
                </span>
              ) : null}
            </label>
            <label>
              Release notes (optional)
              <textarea
                rows={4}
                maxLength={5000}
                value={releaseNotes}
                aria-invalid={Boolean(handoffErrors.releaseNotes)}
                onChange={(event) => setReleaseNotes(event.target.value)}
              />
              {handoffErrors.releaseNotes ? (
                <span className="error" role="alert">
                  {handoffErrors.releaseNotes}
                </span>
              ) : null}
            </label>
            <button className="button" disabled={busy}>
              {busy ? 'Creating…' : 'Send for review'}
            </button>
          </form>
        ) : null}

        {currentHandoff ? <HandoffCard handoff={currentHandoff} /> : null}

        {meta.canRespondToReview &&
        request.status === 'READY_FOR_REVIEW' &&
        currentHandoff?.response === null ? (
          <form
            className={`card ${styles.form}`}
            aria-label={`Respond to review handoff version ${currentHandoff.version}`}
            onSubmit={(event) => {
              event.preventDefault();
              void respond();
            }}
            noValidate
          >
            <h3>Respond to delivery</h3>
            <fieldset>
              <legend>Decision</legend>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="review-decision"
                  value="ACCEPT"
                  checked={reviewDecision === 'ACCEPT'}
                  onChange={() => setReviewDecision('ACCEPT')}
                />
                Accept completion
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="review-decision"
                  value="REQUEST_CHANGES"
                  checked={reviewDecision === 'REQUEST_CHANGES'}
                  onChange={() => setReviewDecision('REQUEST_CHANGES')}
                />
                Request changes
              </label>
            </fieldset>
            <label>
              {reviewDecision === 'ACCEPT' ? 'Completion note (optional)' : 'Change reason'}
              <textarea
                rows={4}
                maxLength={2000}
                value={reviewNote}
                aria-invalid={Boolean(reviewError)}
                onChange={(event) => setReviewNote(event.target.value)}
              />
              {reviewError ? (
                <span className="error" role="alert">
                  {reviewError}
                </span>
              ) : null}
            </label>
            <button className="button" disabled={busy}>
              {busy ? 'Responding…' : reviewDecision === 'ACCEPT' ? 'Accept delivery' : 'Request changes'}
            </button>
          </form>
        ) : null}

        {meta.canCancel && cancellable ? (
          <details className={`card ${styles.cancel}`}>
            <summary>Cancel this request</summary>
            <form
              className={styles.form}
              aria-label="Cancel request"
              onSubmit={(event) => {
                event.preventDefault();
                void cancel();
              }}
              noValidate
            >
              <p>
                Cancellation is terminal. Estimates, comments, work, and history remain read-only and are not
                deleted.
              </p>
              <label>
                Client-visible cancellation reason
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={cancelReason}
                  aria-invalid={Boolean(cancelError)}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </label>
              <label className={styles.confirm}>
                <input
                  type="checkbox"
                  checked={cancelConfirmed}
                  onChange={(event) => setCancelConfirmed(event.target.checked)}
                />
                I confirm that this request should be cancelled permanently.
              </label>
              {cancelError ? (
                <span className="error" role="alert">
                  {cancelError}
                </span>
              ) : null}
              <button className={styles.danger} disabled={busy}>
                {busy ? 'Cancelling…' : 'Cancel request'}
              </button>
            </form>
          </details>
        ) : null}
      </section>

      {meta.canViewPrivateTime ? <TimeSection request={request} /> : null}

      <section className={styles.section} aria-labelledby="history-heading">
        <div className={styles.heading}>
          <div>
            <p className="eyebrow">Oldest first · role filtered</p>
            <h2 id="history-heading">Complete history</h2>
          </div>
          <span>
            Showing {history.length} event{history.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className={styles.timeline} aria-label="Request history">
          {history.length === 0 ? (
            <div className="card">
              <h3>No history on this page</h3>
            </div>
          ) : (
            history.map((item) => (
              <article className={`card ${styles.historyItem}`} key={item.id}>
                <div className={styles.itemHeader}>
                  <strong>{historyTitle(item)}</strong>
                  <time dateTime={item.eventTime}>{new Date(item.eventTime).toLocaleString()}</time>
                </div>
                <HistoryContent item={item} />
                <span>{item.actorDisplayName}</span>
              </article>
            ))
          )}
        </div>
        {(hasPreviousHistory || hasNextHistory) && (
          <nav className={styles.pagination} aria-label="History pages">
            <button
              type="button"
              disabled={!hasPreviousHistory || historyQuery.isFetching}
              onClick={() => setHistoryOffset(Math.max(0, historyOffset - HISTORY_PAGE_SIZE))}
            >
              Earlier events
            </button>
            <span>
              Events {historyOffset + 1}–{historyOffset + history.length}
            </span>
            <button
              type="button"
              disabled={!hasNextHistory || historyQuery.isFetching}
              onClick={() => setHistoryOffset(historyOffset + HISTORY_PAGE_SIZE)}
            >
              Later events
            </button>
          </nav>
        )}
      </section>
    </>
  );
}
