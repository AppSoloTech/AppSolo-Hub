# Claude Review — P004 Comments And Clarification

> Status: Complete. Candidate review and accepted-fix verification both executed
> on 2026-07-27. The final verdict is at the end of this document.

## Review Target

- Base SHA: `c64e42d6f08901b7dd72be9d11bfc37ed3af3149` (exists, commit)
- Candidate SHA: `f7d5d43fa43fafbccbc8f2525b31c9d01a87b045` (exists, commit)
- Exact range:
  `git diff c64e42d6f08901b7dd72be9d11bfc37ed3af3149..f7d5d43fa43fafbccbc8f2525b31c9d01a87b045`
- Diff size: 31 files, +3432/-51 — matches the handoff exactly.

### Boundary Integrity

- Working tree clean at review time (`git status --porcelain` empty), so no
  uncommitted change alters the reviewed result.
- `git diff f7d5d43f..HEAD` (`426e049 P004: record candidate handoff`) touches
  only `markdown/` and `notes/`. No `apps/`, `packages/`, or `e2e/` file differs
  between the candidate SHA and the working tree.
- `git diff --check c64e42d6..f7d5d43f`: clean.
- No `package.json` or `pnpm-lock.yaml` change in the range — the phase added no
  dependency, consistent with "New dependencies: none proposed".
- Non-goal search over `apps/`, `packages/`, and `e2e/` (`aws-sdk`, `@aws`,
  `cognito`, `nodemailer`, `websocket`, `socket.io`, `stripe`, `bullmq`) returns
  no source match. No edit/delete/restore/react/pin/thread route exists.

## Independent Validation Rerun

Run against the local Docker PostgreSQL service (`appsolo-hub-postgres-1`,
healthy) and the isolated `appsolo_client_hub_test` database. The development
database was not modified.

| ID  | Command                                         | Result | Evidence                                                                         |
| --- | ----------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| C1  | `node scripts/check-scaffolding.mjs`            | Passed | 27 required files, 11 phase records.                                             |
| C2  | `pnpm lint`                                     | Passed | ESLint clean; "All matched files use Prettier code style".                       |
| C3  | `pnpm typecheck`                                | Passed | Strict shared, database, API, and web checks.                                    |
| C4  | `pnpm test`                                     | Passed | 17 shared + 8 database tests.                                                    |
| C5  | `pnpm --filter @appsolo/database test:prepare`  | Passed | Guarded test-only reset, migrations applied, seed present.                       |
| C6  | `pnpm test:api`                                 | Passed | 43 tests in 6 files against PostgreSQL.                                          |
| C7  | `pnpm test:web`                                 | Passed | 24 tests in 8 files, including 4 `CommentSection` tests.                         |
| C8  | `pnpm build`                                    | Passed | shared, database, api, and web builds.                                           |
| C9  | `pnpm test:e2e`                                 | Passed | 4 real Playwright flows in 6.9s, including the P004 clarification conversation.  |
| C10 | `pnpm --filter @appsolo/database generate`      | Passed | `No schema changes, nothing to migrate` — no drift after `0006`.                 |
| C11 | `seedDatabase` twice more on the test database  | Passed | Comment/request/estimate/user counts stable at 8/8/7/9 across three seed runs.   |
| C12 | `node scripts/generate-phase-index.mjs --check` | Passed | Index current.                                                                   |
| C13 | `node scripts/validate-phase.mjs P004`          | Passed | Phase structure valid.                                                           |
| C14 | Direct API probes against the test database     | Mixed  | Visibility/ordering/denial correct; two defects found — see P004-F1 and P004-F2. |
| C15 | Captured error-path structured logs             | Failed | Internal comment body appears verbatim in an error log line — see P004-F1.       |

Codex's recorded V1-V20 results are reproducible, and its interim disclosures
(strict-typecheck union correction, sandbox reruns, the `401` vs `404` assertion
correction, three Playwright iterations, generated-JSON formatting, and the
broad prohibited-scope false positive) are honest and do not overstate results.
The one exception is V16, whose captured-log probe covered only the success
path; the error path is not clean (P004-F1).

### Independent Probes

Executed against the assembled app bound to `appsolo_client_hub_test`
(temporary probe scripts, removed afterwards; the working tree is clean).

| Probe                                                          | Expected    | Actual                                               |
| -------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| Client `limit=1&offset=0` then `offset=1` on the mixed request | 1 then 0    | `count 1` then `count 0`, `data: []`, no internal ID |
| Owner `limit=1&offset=1` on the same request                   | internal    | `…0002` internal comment returned                    |
| Client sweep of offsets 0/20/40 after 10 new writes            | no leak     | internal ID and body absent; only `CLIENT_VISIBLE`   |
| Client and owner `offset=999`                                  | `200`, 0    | `200`, `count 0`, identical shape                    |
| `limit=0` / `101` / `1.5` / `abc` / `offset=-1` / repeated key | `400`       | `400` for all six                                    |
| `limit=100`, and defaults with no query                        | accepted    | `200`; meta `limit 50 offset 0`                      |
| `PATCH`/`PUT`/`DELETE` on the collection                       | `404`       | `404` for all three                                  |
| `GET`/`PATCH`/`DELETE` on a single comment ID                  | `404`       | `404` for all three                                  |
| Client create (shared **and** internal) on other-tenant ID     | `404`       | `404 NOT_FOUND` both — no capability oracle          |
| Body exactly 5,000 / 5,001 characters                          | `201`/`400` | `201` / `400`                                        |
| 2,500 astral characters (JS length 5,000)                      | `201`       | `201` — `char_length` is the tolerant direction      |
| Tabs/newlines-only and U+00A0-only bodies                      | `400`       | `400` — Zod `trim()` is stricter than SQL `btrim`    |
| Body containing U+0000                                         | `400`       | **`500 INTERNAL_ERROR`** (P004-F2), no row inserted  |
| `id`/`createdAt`/`changeRequestId`/`authorDisplayName` in body | `400`       | `400` for all four                                   |
| `visibility` lowercase / `PUBLIC` / `null` / `1` / omitted     | `400`       | `400` for all five — no server-side default          |
| 10 equal-`created_at` rows read in pages of 3 vs one page      | identical   | Identical ID sequence, no duplicate, no gap          |
| Request status/status-history after all comment writes         | unchanged   | `SUBMITTED`, `history=1`                             |
| Create/list after membership suspension mid-session            | `404`       | `404 NOT_FOUND` both                                 |

## Requirement And Acceptance Assessment

| Item           | Verdict               | Primary evidence                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1 / AC1-AC3   | Met                   | [policy.ts:5-32](apps/api/src/modules/access/policy.ts#L5-L32) grants `VIEW_COMMENTS`/`CREATE_CLIENT_COMMENTS` to every role and the internal pair only to `OWNER`/`ADMIN`/`DEVELOPER`. [repository.ts:27-54](apps/api/src/modules/comments/repository.ts#L27-L54) re-joins active project, active `CLIENT` organization, and active membership on every read and write. |
| R2 / AC4-AC7   | Met                   | [index.ts](packages/shared/src/index.ts) `createCommentSchema` is `.strict()` with `trim().min(1).max(5000)`; [repository.ts:111-135](apps/api/src/modules/comments/repository.ts#L111-L135) assigns request, author, ID, and timestamps server-side. Ordering `asc(createdAt), asc(id)` verified stable under paging and equal timestamps. No mutation route exists.    |
| R3 / AC8-AC11  | Met                   | [repository.ts:76-84](apps/api/src/modules/comments/repository.ts#L76-L84) applies the `CLIENT_VISIBLE` predicate inside the `WHERE` clause, so `ORDER BY`/`LIMIT`/`OFFSET` and the returned count all operate on filtered rows. The DTO is exactly six fields; probes show no internal ID, body, author, count, or offset gap reaches a client role.                    |
| R4 / AC12-AC14 | Met                   | Comment paths never import estimate or change-request services. The clarification reason survives a full revision cycle (integration test plus my status/history probes), and no comment write touches `status_history`.                                                                                                                                                 |
| R5 / AC15-AC16 | **Not met on AC16**   | Routes, envelopes, request IDs, and the pagination contract are correct ([comment.routes.ts](apps/api/src/modules/comments/comment.routes.ts)). Response output is safely redacted. Application logs are not — see P004-F1. Invalid-input status mapping has one gap — see P004-F2.                                                                                      |
| R6 / AC17-AC20 | Met with observations | [CommentSection.tsx](apps/web/src/features/comments/CommentSection.tsx) delivers the safe `INTERNAL_ONLY` default and reset, client-only shared composition, persistent text labels, focus/announcement, `overflow-wrap: anywhere`, and a 620px layout. See P004-F3, P004-F4, P004-F5.                                                                                   |
| R7 / AC21-AC22 | Met                   | [0006_rapid_blockbuster.sql](packages/database/drizzle/0006_rapid_blockbuster.sql) only replaces two indexes and adds a validated `CHECK`; no row or enum is touched. Drizzle reports no drift. Seed is stable at 8 comments across three consecutive runs with deterministic equal-timestamp fixtures.                                                                  |
| R8 / AC23-AC24 | Met with observation  | 96 tests across five layers pass on rerun; P001/P002/P003 regressions are intact. The AC16 assertion is missing for the error path, which is how P004-F1 survived.                                                                                                                                                                                                       |

Named invariants hold except the logging invariant: active user/organization/
project/membership are required on every operation, internal AppSolo membership
alone grants nothing (verified `404` for `internalOnlyUser`), services own
capabilities while repositories execute scoped SQL, frontend hiding is never the
control, internal content never reaches client roles, no hard-delete API exists,
comments never mutate P003 state, databases stay separate, migrations are
additive, and no AWS or external coupling entered. The production
development-auth guard at [env.ts:65-66](apps/api/src/config/env.ts#L65-L66) is
untouched.

## Findings

### P004-F1 — Comment bodies, including internal-only content, reach application logs on any database-layer failure (High)

- **Affects:** R5, AC16, the P004 invariant "Comment bodies never enter
  application logs or unsafe error output", and the `SECURITY.md` prohibition on
  logging comment bodies.
- **Evidence:** the generic handler logs the raw error at
  [app.ts:115](apps/api/src/app.ts#L115)
  (`request.log.error({ err: error }, 'unhandled request error')`). A
  `DrizzleQueryError` carries `query` and `params` as own enumerable properties,
  and pino's default `err` serializer emits them. The redact list at
  [app.ts:47-53](apps/api/src/app.ts#L47-L53) covers `req.body` but not
  `err.params` or `err.message`.
- **Reproduction (executed against `appsolo_client_hub_test`):** POST an
  `INTERNAL_ONLY` comment whose body contains a `U+0000` byte. The API returns a
  correctly redacted `500` envelope, but the captured log line contains the
  body verbatim:

  ```json
  "err": {
    "message": "Failed query: insert into \"comments\" ... params: 30000000-…,20000000-…,ZZSECRETCOMMENTZZ<NUL>tail,INTERNAL_ONLY: invalid byte sequence…",
    "params": ["30000000-…", "20000000-…", "ZZSECRETCOMMENTZZ<NUL>tail", "INTERNAL_ONLY"]
  }
  ```

  The body appears three times per failure (message, stack, and `params`).

- **Impact:** internal-only comment content is persisted to application logs,
  which are normally readable by operators outside the tenant boundary that P004
  exists to enforce. The `U+0000` case is only the cheapest trigger; any
  driver-level failure on the insert path — connection reset, serialization
  failure, or a deadlock on the new `FOR SHARE` lock at
  [repository.ts:118-121](apps/api/src/modules/comments/repository.ts#L118-L121)
  — produces the same line with an ordinary body.
- **Scope note (for proportionate disposition):** this is framework-level
  behavior inherited from P001. I reproduced the identical leak for a P001
  change-request title and a P003 estimate scope note. It is reported against
  P004 because P004 is the phase that makes this an explicit binding invariant
  and records V16 as passed; the V16 probe exercised only the success path.
- **Recommended correction:** add a pino `err` serializer in
  [app.ts](apps/api/src/app.ts) that emits `type`, a truncated `message`, and
  `code` only, dropping `query`, `params`, and `stack` from serialized errors —
  or catch driver errors in the repository and re-throw a body-free `AppError`.
  Add an API test asserting that a forced insert failure produces no body
  sentinel in captured logs, so AC16 gains error-path evidence.

### P004-F2 — A `U+0000` character in a comment body returns `500 INTERNAL_ERROR` instead of a safe `400` (Medium)

- **Affects:** R5 ("use safe field-specific `400 VALIDATION_ERROR` output") and
  AC5.
- **Evidence:** `createCommentSchema` in
  [index.ts](packages/shared/src/index.ts) validates trimmed length only.
  PostgreSQL rejects `U+0000` in `text` with `invalid byte sequence for encoding
"UTF8": 0x00`, which falls through to the generic branch at
  [app.ts:113](apps/api/src/app.ts#L113).
- **Reproduction:** `POST /api/v1/change-requests/:id/comments` with a body
  containing a `U+0000` character, from any authorized actor, returns
  `500 INTERNAL_ERROR`. The comment row count is unchanged (2 → 2), so there is
  no data-integrity consequence.
- **Impact:** an authorized user can produce a `500` from ordinary input; a
  `U+0000` is reachable by pasting into the textarea. It defeats the
  "safe field-specific validation" contract and converts a user mistake into an
  error-level log line, which is the trigger used in P004-F1.
- **Scope note:** also reproducible on the P001 change-request and P003 estimate
  write paths, so a shared refinement is the proportionate fix.
- **Recommended correction:** add a shared refinement rejecting `U+0000` to the
  comment body schema, ideally as a reusable safe-text helper applied to the
  other free-text schemas as well.

### P004-F3 — Successful creation returns the reader to the first page, so the new comment is invisible on a paginated conversation (Medium)

- **Affects:** R6 ("Successful creation clears the form, announces success…"),
  AC19, and human QA case Q8.
- **Evidence:** `submit` calls `setOffset(0)` at
  [CommentSection.tsx:52](apps/web/src/features/comments/CommentSection.tsx#L52),
  while list order is oldest-first, so a new comment always lands on the _last_
  page.
- **Reproduction:** with more than 20 visible comments on a request, page to the
  end, post a comment, and observe "Comment added." — the feed jumps to comments
  1–20 and the new comment is not shown anywhere on screen.
- **Impact:** the success announcement is not corroborated by anything the user
  can see. Q8 asks the human to "create concurrent and enough sequential
  comments to paginate; confirm none are lost or duplicated"; this behavior
  reads as a lost comment during exactly that case, and is a likely support
  question in normal use.
- **Recommended correction:** after a successful create, move to the page that
  contains the new comment rather than to offset 0, or keep the current offset
  and surface a "jump to your comment" affordance. Extend the component test to
  cover posting while `offset > 0`.

### P004-F4 — "Later comments" is enabled on an exactly-full final page and leads to an empty page with the same copy as an empty conversation (Low)

- **Affects:** R6/AC19 empty and pagination states.
- **Evidence:** `hasNext = meta.count === PAGE_SIZE` at
  [CommentSection.tsx:91](apps/web/src/features/comments/CommentSection.tsx#L91).
  `meta.count` is the returned page count, so a conversation with exactly 20, 40,
  … visible comments always reports a further page.
- **Reproduction:** with exactly 20 visible comments, click "Later comments" —
  the feed renders "No comments on this page" (identical to the true empty state
  at [CommentSection.tsx:118](apps/web/src/features/comments/CommentSection.tsx#L118))
  and the range label reads "Comments 21–20".
- **Impact:** cosmetic confusion only. I confirmed it is **not** a client oracle:
  because filtering precedes pagination, a client and an internal viewer of the
  same request each reach the empty page under their own filtered count, so
  nothing reveals that internal rows exist.
- **Recommended correction:** request `PAGE_SIZE + 1` and trim, or distinguish
  "no comments yet" from "no further comments" and suppress the negative range
  label.

### P004-F5 — Composer state is not keyed to the change request, so a shared visibility selection could survive into another request's fresh composer (Low)

- **Affects:** the binding "internal safety default" decision and R6 ("defaults
  to `INTERNAL_ONLY` on every fresh form/reset").
- **Evidence:** `visibility`, `body`, and `offset` are plain `useState` at
  [CommentSection.tsx:18-20](apps/web/src/features/comments/CommentSection.tsx#L18-L20)
  and are never reset when `changeRequestId` changes. React Router reuses the
  same element instance for `/change-requests/:changeRequestId` when only the
  parameter changes, so the component would not remount.
- **Impact and honest reachability:** I could not reach this through the shipped
  UI — every navigation into a detail page passes through the list or a full page
  load, both of which remount the component. It is a latent trap rather than a
  live defect, and it becomes live the moment any request-to-request link is
  added.
- **Recommended correction:** add `key={changeRequestId}` where `CommentSection`
  is composed in
  [ChangeRequestDetail.tsx:50](apps/web/src/features/change-requests/ChangeRequestDetail.tsx#L50),
  or reset `visibility`/`body`/`offset` in an effect keyed on `changeRequestId`.

## Non-Findings Worth Recording

- The `.for('share', { of: [changeRequests, organizationMemberships] })` lock is
  correctly placed: a concurrent membership suspension either blocks until the
  insert commits or is observed by the in-transaction recheck. Both concurrent
  valid creates return `201` and both rows persist.
- Historical authorship works as specified. `comments → users` is joined
  directly with no membership predicate, so a suspended author's past comments
  stay attributed ("Sam Suspended") while that identity is denied `404` for new
  reads and writes, and `401` once globally suspended.
- `commentPaginationSchema.pick({})` on the create route is obscure but correct:
  Zod preserves `unknownKeys: 'strict'` through `pick`, so any query string on
  `POST` is a `400`. Verified live.
- The repository's `list` filters on `changeRequestId` alone after the service
  resolves tenant scope. This mirrors the P003 estimate repository exactly and
  is not a new defense-in-depth regression.
- Zod's `trim()` is strictly more aggressive than SQL `btrim`, and JS string
  length is never smaller than `char_length`, so the API and database body
  contracts cannot disagree in the unsafe direction.
- The list-error branch offers no retry control, matching the reviewed P003
  `EstimateSection` pattern; in-progress composer text is preserved in state and
  reappears when the query recovers.

## Candidate Verdict

`changes requested`

---

# Fix Verification — 2026-07-27

> Status: Complete. All five findings verified fixed at the review-fix SHA.

## Fix Review Target

- Candidate SHA: `f7d5d43fa43fafbccbc8f2525b31c9d01a87b045`
- Review-fix SHA: `4c328f74a57076fa19f57937ae30867d5fabcbd2` (exists, commit)
- Evidence-handoff SHA: `d3c0d7581d0ad9a9ee99c7f7038c8b22f24d16cb` (exists, commit)
- Exact fix range:
  `git diff 426e0491212d55ad4018055b7705779fab337062..4c328f74a57076fa19f57937ae30867d5fabcbd2`
- Fix size: 17 files, +785/-90. `d3c0d758` touches only `markdown/` and
  `notes/`.
- `git diff --check 426e0491..4c328f74`: clean.
- Working tree clean at verification time.
- No `package.json` or lockfile change; no migration, schema, seed, capability,
  route, or repository change. The fixes touch `app.ts` logging, the shared
  comment body schema, `CommentSection`, one `key` prop, tests, and contracts.
  No new scope entered.

## Independent Validation Rerun (Fix SHA)

| ID  | Command                                         | Result | Evidence                                                      |
| --- | ----------------------------------------------- | ------ | ------------------------------------------------------------- |
| D1  | `pnpm lint`                                     | Passed | ESLint and Prettier clean.                                    |
| D2  | `pnpm typecheck`                                | Passed | Strict shared, database, API, and web checks.                 |
| D3  | `pnpm test`                                     | Passed | 17 shared + 8 database tests.                                 |
| D4  | `pnpm test:api`                                 | Passed | 44 tests in 6 files, including the new forced-error log test. |
| D5  | `pnpm test:web`                                 | Passed | 26 tests in 8 files, including 6 `CommentSection` tests.      |
| D6  | `pnpm build`                                    | Passed | shared, database, api, and web builds.                        |
| D7  | `pnpm test:e2e`                                 | Passed | 4 real Playwright flows in 7.3s.                              |
| D8  | `pnpm --filter @appsolo/database generate`      | Passed | `No schema changes, nothing to migrate` — still no drift.     |
| D9  | `node scripts/check-scaffolding.mjs`            | Passed | 27 required files, 11 phase records.                          |
| D10 | `node scripts/generate-phase-index.mjs --check` | Passed | Index current.                                                |
| D11 | `node scripts/validate-phase.mjs P004`          | Passed | Phase structure valid.                                        |
| D12 | Direct API/log probes at the fix SHA            | Passed | All five findings verified fixed — see below.                 |

Codex's claim of 99 passing tests (17 + 8 + 44 + 26 + 4) reproduces exactly, and
its disclosure that the first serializer attempt failed because `pino-http`
replaced the base logger's serializer is accurate — the fix installs
`safeErrorSerializer` at both the base and `pinoHttp` layers
([app.ts:60,86](apps/api/src/app.ts#L60)).

**Environment note, not a finding:** my first `pnpm test` run failed one P003
database assertion (`expected '0.02' to be '562.50'`) because I had run
`pnpm test:e2e` immediately before, and the e2e estimate flow mutates the seeded
draft. `pnpm test` does not run `test:prepare` itself. After
`pnpm --filter @appsolo/database test:prepare` all 25 tests pass. This ordering
dependency predates P004 and is outside its diff.

## Finding-By-Finding Verification

### P004-F1 — Verified fixed

The fix adds `safeErrorSerializer` and wires it into both the base logger and
the `pinoHttp` child ([app.ts:42-60,86](apps/api/src/app.ts#L42-L60)).

I forced genuine PostgreSQL failures with `BEFORE INSERT` triggers that raise an
exception carrying the row's own text, on three tables, and captured every log
line through an injected destination:

| Forced failure           | Response      | Sentinel in logs | `params` | `query` | `stack` | driver message |
| ------------------------ | ------------- | ---------------- | -------- | ------- | ------- | -------------- |
| `comments` insert        | `500` generic | absent           | absent   | absent  | absent  | absent         |
| `change_requests` insert | `500` generic | absent           | absent   | absent  | absent  | absent         |
| `estimates` insert       | `500` generic | absent           | absent   | absent  | absent  | absent         |

The complete captured line is now:

```json
{"level":50,"time":…,"requestId":"9b4a00ef-…","err":{"type":"DrizzleQueryError"},"msg":"unhandled request error"}
```

No comment body, change-request title, estimate scope note, SQL text, bound
parameter, stack frame, or database URL survives. The original reproduction from
P004-F1 no longer leaks, and the P001/P003 paths I cited in the finding's scope
note are covered by the same central fix. The new integration test at
[comments.integration.test.ts:255-307](apps/api/src/modules/comments/comments.integration.test.ts#L255-L307)
uses the same forced-trigger technique and asserts the absence of the sentinel,
`params`, `query`, and `stack`, so AC16 now has durable error-path evidence.

`SECURITY.md` was updated to state that raw messages, stacks, SQL, and
parameters are omitted from logs, so the deliberate loss of stack traces is a
recorded contract decision rather than an oversight.

### P004-F2 — Verified fixed

`safeTextSchema` rejects `U+0000` in the comment body
([index.ts](packages/shared/src/index.ts)). Live probe:

```json
400 {"code":"VALIDATION_ERROR","details":[{"path":"body","message":"Comment contains an unsupported character."}]}
```

The rejection is field-specific on `body`, happens before PostgreSQL sees the
value, inserts nothing, and no longer produces an error-level log line. Covered
by both a shared unit case and
[comments.integration.test.ts:222-232](apps/api/src/modules/comments/comments.integration.test.ts#L222-L232).

### P004-F3 — Verified fixed

`submit` now resolves the created comment's real page via
`findCommentPageOffset` and navigates there
([CommentSection.tsx:11-25,66-75](apps/web/src/features/comments/CommentSection.tsx#L11-L25)).

I replicated the browser's algorithm against the real API with 45
client-visible comments (plus 44 interleaved internal rows):

| Scenario                                 | Result                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| Post while on the final page (offset 40) | Located offset `40`; new comment rendered; no duplicate   |
| Post while on the first page (offset 0)  | Relocated to offset `40`; new comment rendered            |
| Scan requests needed                     | One `limit=100` call per 100 rows from the current offset |

The returned offset stays a multiple of the page size in every case, and the
implementation searches for the returned comment ID rather than assuming it
sorts last — which is the more robust choice, since a seeded or backdated
`created_at` can place a new comment mid-list. The `catch` fallback keeps the
current offset if the scan fails, so a network error cannot strand the user.

### P004-F4 — Verified fixed

The feed now fetches `PAGE_SIZE + 1`, renders 20, and derives
`hasNext = data.length > PAGE_SIZE`
([CommentSection.tsx:112-114](apps/web/src/features/comments/CommentSection.tsx#L112-L114)).

With exactly 40 visible comments, the second page fetches 20 rows and reports
`hasNext = false` — the misleading "Later comments" button and the
"Comments 21–20" label are both gone. The `Showing …` and range labels now use
the rendered slice rather than `meta.count`.

I specifically checked the concern raised in the fix handoff — that the
21st lookahead row could become an existence oracle. It cannot: the API filters
internal rows in SQL, so a client's `limit=21` response contained only
`CLIENT_VISIBLE` rows at every offset (0/20/40 → 21/21/5 rows). The lookahead
slot is filled from the viewer's own filtered set and reveals nothing about the
44 internal rows present on the same request.

### P004-F5 — Verified fixed

`CommentSection` is now composed with `key={request.id}`
([ChangeRequestDetail.tsx:50](apps/web/src/features/change-requests/ChangeRequestDetail.tsx#L50)),
which forces a remount on any request change, so `visibility`, `body`, and
`offset` all reinitialize and the composer always starts at `INTERNAL_ONLY`.
This closes the latent trap exactly as recommended.

## Residual Observations (Non-Blocking, No Action Required For P004)

- **Error logs carry no SQLSTATE.** In every forced failure I produced, the
  serialized object was `{"type":"DrizzleQueryError"}` — the `code` branch of
  `safeErrorSerializer` did not surface a value even though the underlying
  `DatabaseError.code` (`22021`, `P0001`) was present on `error.cause`. A
  SQLSTATE contains no user data and is the single most useful triage datum, so
  a future phase may want to make that branch reliably resolve. Nothing unsafe
  is emitted either way.
- **`U+0000` still yields `500` on the P001 change-request and P003 estimate
  write paths.** `safeTextSchema` was applied only to the comment body, which is
  correct scope discipline for P004; the log-leak half of that behavior is
  already fixed globally by P004-F1's serializer. Worth a small follow-up in a
  later phase.
- **`findCommentPageOffset` costs one extra `limit=100` request per 100 rows
  after each post.** Negligible at realistic conversation sizes and bounded by
  the real data, but worth remembering if comment volumes grow.

## Verdict

`ready with non-blocking observations`
