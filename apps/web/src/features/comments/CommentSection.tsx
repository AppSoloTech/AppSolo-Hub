import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createCommentSchema, type ChangeRequestStatus, type CommentVisibility } from '@appsolo/shared';
import { useEffect, useRef, useState } from 'react';
import { ApiError, commentsApi, currentDevelopmentUserId } from '../../api.js';
import styles from './CommentSection.module.css';

const PAGE_SIZE = 20;

export function CommentSection({
  changeRequestId,
  requestStatus,
}: {
  changeRequestId: string;
  requestStatus: ChangeRequestStatus;
}) {
  const queryClient = useQueryClient();
  const identity = currentDevelopmentUserId() ?? 'anonymous';
  const [offset, setOffset] = useState(0);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<CommentVisibility>('INTERNAL_ONLY');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const queryKey = ['comments', identity, changeRequestId, PAGE_SIZE, offset] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => commentsApi.list(changeRequestId, PAGE_SIZE, offset),
  });

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const submit = async () => {
    const canUseInternal = query.data?.meta.canCreateInternalComments ?? false;
    const parsed = createCommentSchema.safeParse({
      body,
      visibility: canUseInternal ? visibility : 'CLIENT_VISIBLE',
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Check the comment.');
      return;
    }
    setValidationError(null);
    setFeedback(null);
    setBusy(true);
    try {
      await commentsApi.create(changeRequestId, parsed.data);
      setBody('');
      setVisibility('INTERNAL_ONLY');
      setOffset(0);
      await queryClient.invalidateQueries({
        queryKey: ['comments', identity, changeRequestId],
      });
      setFeedback({ kind: 'success', message: 'Comment added.' });
    } catch (error: unknown) {
      setFeedback({
        kind: 'error',
        message:
          error instanceof ApiError
            ? error.message
            : 'The comment could not be added. Your text has been preserved.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (query.isPending) {
    return (
      <section className={styles.section} aria-labelledby="conversation-heading">
        <h2 id="conversation-heading">Request conversation</h2>
        <p>Loading conversation…</p>
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className={styles.section} aria-labelledby="conversation-heading">
        <h2 id="conversation-heading">Request conversation</h2>
        <p className="error" role="alert">
          The conversation is unavailable.
        </p>
      </section>
    );
  }

  const { data: comments, meta } = query.data;
  const hasPrevious = offset > 0;
  const hasNext = meta.count === PAGE_SIZE;

  return (
    <section className={styles.section} aria-labelledby="conversation-heading">
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Oldest first</p>
          <h2 id="conversation-heading">Request conversation</h2>
        </div>
        <span>
          Showing {meta.count} comment{meta.count === 1 ? '' : 's'}
        </span>
      </div>

      {requestStatus === 'NEEDS_CLARIFICATION' ? (
        <div className={styles.clarification}>
          <strong>Clarification is needed.</strong>
          <p>
            The client’s original reason remains in the estimate history above. Continue the discussion here;
            adding a comment does not resolve the clarification or submit a revised estimate.
          </p>
        </div>
      ) : null}

      <div className={styles.feed} aria-label="Request comments">
        {comments.length === 0 ? (
          <div className="card">
            <h3>No comments on this page</h3>
            <p>Start the conversation with a clear update or question.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <article className={`card ${styles.comment}`} key={comment.id}>
              <div className={styles.commentHeader}>
                <strong>{comment.authorDisplayName}</strong>
                <span>{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <span className={styles.visibility}>
                {comment.visibility === 'INTERNAL_ONLY' ? 'Internal only' : 'Shared with client'}
              </span>
              <p>{comment.body}</p>
            </article>
          ))
        )}
      </div>

      {(hasPrevious || hasNext) && (
        <nav className={styles.pagination} aria-label="Conversation pages">
          <button
            type="button"
            disabled={!hasPrevious || query.isFetching}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Earlier comments
          </button>
          <span>
            Comments {offset + 1}–{offset + meta.count}
          </span>
          <button
            type="button"
            disabled={!hasNext || query.isFetching}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Later comments
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

      {meta.canCreateClientComments ? (
        <form
          className={`card ${styles.form}`}
          aria-label="Add a request comment"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          <div>
            <p className="eyebrow">Add to the conversation</p>
            <h3>New comment</h3>
          </div>
          {meta.canCreateInternalComments ? (
            <div className={styles.field}>
              <label htmlFor="comment-visibility">Who can see this?</label>
              <select
                id="comment-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as CommentVisibility)}
              >
                <option value="INTERNAL_ONLY">Internal only</option>
                <option value="CLIENT_VISIBLE">Shared with client</option>
              </select>
              <span>Internal only is the safe default for every new comment.</span>
            </div>
          ) : (
            <p className={styles.clientNotice}>Your comment will be shared with the client team.</p>
          )}
          <div className={styles.field}>
            <label htmlFor="comment-body">Comment</label>
            <textarea
              id="comment-body"
              rows={5}
              maxLength={5000}
              value={body}
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'comment-body-error' : 'comment-body-help'}
              onChange={(event) => setBody(event.target.value)}
            />
            <span id="comment-body-help">{body.length.toLocaleString()} / 5,000 characters</span>
            {validationError ? (
              <span id="comment-body-error" className="error" role="alert">
                {validationError}
              </span>
            ) : null}
          </div>
          <button className="button" disabled={busy}>
            {busy ? 'Adding…' : 'Add comment'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
