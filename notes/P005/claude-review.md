# Claude Review — P005 Time Tracking, Status, And Completion

> Reviewer: Claude (independent review agent, read-only).
> Review date: 2026-07-27.

## Review Target

- Base SHA: `96f3d6158e2971f49a1b7e832dc6c2292001580e`.
- Candidate SHA: `df588175193707db9a65446eebb29de76e44eb21`.
- Exact range: `96f3d6158e2971f49a1b7e832dc6c2292001580e..df588175193707db9a65446eebb29de76e44eb21`.

## Review Boundary

| Item                   | Result                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base SHA exists        | Yes — `96f3d61` (`P005: approve time tracking status and completion`).                                                                                                                                                                                     |
| Candidate SHA exists   | Yes — `df58817` (`P005: implement time tracking status and completion`).                                                                                                                                                                                   |
| SHAs match the handoff | Yes.                                                                                                                                                                                                                                                       |
| Working tree           | Clean (`git status --porcelain` empty before and after my probes).                                                                                                                                                                                         |
| Local `HEAD`           | `9e739e8` (`P005: record candidate handoff`). Its diff against the candidate touches only `markdown/CURRENT_STATE.md`, `markdown/PHASE_INDEX.md`, the P005 phase record, and `notes/P005/implementation-handoff.md` — evidence only, no reviewed behavior. |
| Diff scope             | 37 files, +6582/−101, all within the P005 likely-affected areas. No unrelated refactor obscures the phase diff.                                                                                                                                            |
| Reviewed as committed  | Yes. Every probe ran against the committed tree; the temporary probe file was deleted and the tree re-verified clean.                                                                                                                                      |

The only code outside the P005 domain is the React strict-mode fix in
[InvitationAcceptance.tsx](apps/web/src/session/InvitationAcceptance.tsx) and the
isolated-port support in [playwright.config.ts](e2e/playwright.config.ts). Both are
disclosed in the handoff, both are required to produce P005's browser evidence on a
machine with the normal development servers running, and both carry matching test
changes — [Session.test.tsx:96-107](apps/web/src/session/Session.test.tsx#L96-L107) now
asserts single-flight acceptance under `StrictMode`. I do not treat them as scope creep.

## Validation

Every command below was rerun by me against the committed candidate.

| ID  | Result  | Evidence                                                                                                                                                                                                                                                                                                         |
| --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Passed  | `node scripts/check-scaffolding.mjs` — 27 required files, 11 phase records.                                                                                                                                                                                                                                      |
| V2  | Not run | `pnpm install` was not rerun. The lockfile is unchanged in the diff and every build/test command resolved without a workspace error.                                                                                                                                                                             |
| V3  | Passed  | `docker ps` — `appsolo-hub-postgres-1` healthy.                                                                                                                                                                                                                                                                  |
| V4  | Passed  | Verified indirectly: `test:prepare` applied the checked-in migrations including `0007` without error, and V7 reports no drift.                                                                                                                                                                                   |
| V5  | Passed  | `pnpm db:seed` — `Seed data is present.` against an already-seeded database (idempotent).                                                                                                                                                                                                                        |
| V6  | Passed  | `pnpm --filter @appsolo/database test:prepare` — migrations and seed applied to the isolated test database only.                                                                                                                                                                                                 |
| V7  | Passed  | `pnpm --filter @appsolo/database generate` — 15 tables inspected, `No schema changes, nothing to migrate`.                                                                                                                                                                                                       |
| V8  | Passed  | `pnpm lint` — ESLint clean; `All matched files use Prettier code style!`.                                                                                                                                                                                                                                        |
| V9  | Passed  | `pnpm typecheck` — shared/database builds plus strict API and web checks.                                                                                                                                                                                                                                        |
| V10 | Passed  | `pnpm test` — shared 20/20, database 11/11.                                                                                                                                                                                                                                                                      |
| V11 | Passed  | `pnpm test:api` — 7 files, 52/52 against PostgreSQL.                                                                                                                                                                                                                                                             |
| V12 | Passed  | `pnpm test:web` — 9 files, 31/31.                                                                                                                                                                                                                                                                                |
| V13 | Passed  | `pnpm build` — shared, database, API, and Vite web production builds.                                                                                                                                                                                                                                            |
| V14 | Passed  | `PLAYWRIGHT_API_PORT=4100 PLAYWRIGHT_WEB_PORT=5273 pnpm test:e2e` — 5/5 real browser tests, including the full approved-to-completed work cycle.                                                                                                                                                                 |
| V15 | Passed  | Replaced with my own direct probes A–G (below) against the isolated test database.                                                                                                                                                                                                                               |
| V16 | Passed  | The forced-database-failure redaction test ran inside V11 and passed.                                                                                                                                                                                                                                            |
| V17 | Passed  | `node scripts/generate-phase-index.mjs --check` — `PHASE_INDEX.md is current`.                                                                                                                                                                                                                                   |
| V18 | Passed  | `git diff --check <base>..<candidate>` — no output, exit 0.                                                                                                                                                                                                                                                      |
| V19 | Passed  | My own manifest and import scan found no AWS/Cognito/Amplify/Stripe/queue/cron dependency and no billing, invoice, payroll, timer, `setInterval`, assignee, webhook, or outbox runtime code. The one textual hit is the UI disclaimer at [WorkSection.tsx:199](apps/web/src/features/work/WorkSection.tsx#L199). |
| V20 | Passed  | `node scripts/validate-phase.mjs P005` — `P005 phase structure is valid`.                                                                                                                                                                                                                                        |

No validation was skipped, stubbed, or no-op. Every result recorded in the handoff
reproduced exactly.

### Direct probes

I added one temporary integration file, ran it, deleted it, and re-verified a clean tree.

- **A** — `POST /api/v1/time-entries/{seeded active entry}/void` as `CLIENT_ADMIN` → `403`;
  the same route with an unused UUID → `404`; as `CLIENT_MEMBER` → `403`. See P005-F1.
- **B** — `POST /api/v1/change-requests/{in-progress}/time-entries` as `CLIENT_ADMIN` → `403`,
  while `GET` on the same collection → `404`. See P005-F2.
- **C** — `OWNER` responding to a handoff → `403`; a user with no client membership → `404`.
  Matches R4 and R6.
- **D** — Internal history for the completed fixture returns all eight events oldest-first with
  `STATUS_CHANGED` preceding `WORK_HANDOFF`/`WORK_REVIEW_RESPONSE` at identical timestamps, and
  `meta.currentHandoff` carries the accepted version 2 handoff with its response.
- **E** — After cancellation: comments still return `201` (P004 invariant intact), `work/start`
  returns `409`, and the retained estimate draft is frozen with `409`.
- **F** — A second response to an already-answered handoff returns `409`.
- **G** — Time listing is per change request; an unrelated request in the same tenant returns
  `count: 0`, `activeDurationMinutes: 0`.

## What I Verified As Correct

- **Capability matrix (R1/AC1).** [policy.ts:19-59](apps/api/src/modules/access/policy.ts#L19-L59)
  matches R1 exactly. No role holds both `RESPOND_TO_WORK_REVIEW` and `MANAGE_REQUEST_WORK`, so
  internal self-acceptance is structurally impossible; `DEVELOPER` has no `MANAGE_PRIVATE_TIME`
  and no `CANCEL_REQUESTS`; `CLIENT_MEMBER` has history only.
- **Tenant isolation (R1/AC2).** Every P005 path re-derives scope through
  [`requestContextQuery`](apps/api/src/modules/work/repository.ts#L58-L87), requiring an active
  membership, `projects.status = ACTIVE`, `organizations.status = ACTIVE`, and
  `organizations.type = CLIENT`. The two ID-rooted routes (`void`, `respond`) repeat the same
  join chain instead of trusting a path parameter. Other-tenant, internal-only, suspended,
  globally-suspended, inactive-project, and inactive-organization cases return `404`/`401` with
  no resource data.
- **Time lifecycle (R2/AC4–AC7).** Creation is gated to exactly `IN_PROGRESS` inside the
  transaction ([repository.ts:171](apps/api/src/modules/work/repository.ts#L171)); the actor is
  always the authenticated user and the strict schema exposes no user field. Void is all-or-none
  at both application and database layers, preserves every original column, and its double guard
  (`voidedAt !== null` plus `where ... isNull(voidedAt)`) makes a second void impossible. Totals
  use integer `sum(...)::integer` over non-voided rows per request, so they are stable across
  pagination and carry no cost implication.
- **Transition graph (R3/AC8–AC11).** There is no generic status route. Each command locks the
  request row `FOR UPDATE`, re-checks capability, exact source status, and `expectedUpdatedAt`,
  then performs a conditional `UPDATE ... WHERE status = <expected>` before inserting exactly one
  status-history row in the same transaction. V11's assertion of `status = COMPLETED, count = 6`
  proves the atomic history count across a full two-cycle run.
- **Estimate freeze (AC12).** [estimates/repository.ts:243-248](apps/api/src/modules/estimates/repository.ts#L243-L248)
  adds the request-status gate `updateDraft` was missing; `submitDraft` and `respond` already
  excluded terminal states. Probe E confirms cancellation rewrites no estimate row, term,
  version, or status.
- **Handoff and response immutability (R4/AC13–AC16).** Version allocation is serialized by the
  request-row lock and backed by `unique(change_request_id, version)` with a `23505` → `409`
  mapping at [service.ts:184](apps/api/src/modules/work/service.ts#L184). Responses add
  `unique(handoff_id)` plus a latest-version check. V11's paired concurrent calls produce exactly
  `[200, 409]` for void, handoff, and response.
- **Chronology (R5/AC17–AC19).** Private time and internal comments are removed at _source-query_
  time via the `includeInternal` flag
  ([repository.ts:590-626](apps/api/src/modules/work/repository.ts#L590-L626)), before any
  ordering, slicing, or DTO construction — so there is no count, gap, or placeholder oracle.
  Mutable drafts are excluded for every role. Ordering is event time → stable kind rank → source
  ID, all on application-owned values. DTOs carry only display names; no email, membership row,
  raw row, token, or SQL detail is reachable.
- **Log and error redaction (AC21).** The forced-trigger-failure test asserts absence of the body
  sentinel, auth/cookie sentinel, database URL, `body`/`params`/`query`/`stack` keys, the raw
  PostgreSQL message, and "SQL parameters". It passed in my rerun.
- **Migration safety (R8/AC25).** `0007` is purely additive: three nullable columns, two tables,
  one enum, replaced indexes, and new `CHECK` constraints. No `DROP TABLE`, no `DROP COLUMN`, no
  data rewrite. The only tightening is `time_entries_duration_positive` → `between 1 and 1440`;
  since no pre-P005 code path or seed ever created a `time_entries` row, no existing data can
  fail it. Drizzle reports no drift.
- **UI role-awareness (R7).** The private-time section mounts only behind `meta.canViewPrivateTime`
  ([WorkSection.tsx:793](apps/web/src/features/work/WorkSection.tsx#L793)), so client roles issue
  no time request and render no placeholder or spacing artifact — asserted both by the component
  test (`expect(api.timeEntries).not.toHaveBeenCalled()`) and by the browser test. Start-work
  appears only on `APPROVED`, the handoff form only on `IN_PROGRESS`, and the response form only
  on `READY_FOR_REVIEW` with an unanswered handoff. Cancellation requires an explicit
  confirmation checkbox plus a reason and is never an arbitrary status selector. Errors preserve
  input and move focus to an announced `role="status"`/`role="alert"` element.
- **Documentation.** API, DATA_MODEL, SECURITY, INTEGRATIONS, ARCHITECTURE, TESTING, README, and
  ADR-0003 describe the behavior I observed, with the one exception recorded in P005-F1.

## Findings

### P005-F1 — Void route leaks private-time existence to client roles

- **Severity:** High
- **Requirement affected:** R2 ("Private time rows, totals, dates, authors, voids, counts,
  timing, and existence are never returned to client roles"); binding decision 2 ("client roles
  receive no existence signal"); AC3; Q4 ("both client roles and direct API probes receive no
  time row, total, count, placeholder, gap, or existence signal"); and the contract text in
  [API.md](markdown/contracts/API.md), which states "missing action capability returns `403`
  **except where private-time existence itself is protected**".
- **Evidence:** [service.ts:157-164](apps/api/src/modules/work/service.ts#L157-L164) calls
  `repository.voidTimeEntry` with no `VIEW_PRIVATE_TIME` gate — unlike
  [`listTimeEntries`](apps/api/src/modules/work/service.ts#L125-L127), which correctly does
  `if (!canViewTime(context.role)) throw notFound()`. The repository at
  [repository.ts:232-233](apps/api/src/modules/work/repository.ts#L232-L233) computes
  `allowed = canManage(role) || (entryUserId === userId && canVoidOwn(role))`; for a client role
  both terms are false, so it returns `FORBIDDEN`, which
  [service.ts:100](apps/api/src/modules/work/service.ts#L100) maps to `403`. The preceding query
  succeeds only when the entry exists inside the caller's active tenant, so the returned status
  code is a direct function of row existence.
- **Reproduction (probe A, isolated test database):**
  1. `POST /api/v1/time-entries/61000000-0000-4000-8000-000000000001/void` with
     `x-dev-user-id: 20000000-0000-4000-8000-000000000003` (client administrator) and a valid
     body → `403 FORBIDDEN`.
  2. The same request against `61000000-0000-4000-8000-000000000099` (unused UUID) → `404 NOT_FOUND`.
  3. The same request as `CLIENT_MEMBER` against the real entry → `403`.
- **Impact:** A client-tenant role can distinguish "this UUID is an existing time entry on a
  request in my tenant" from "this UUID is nothing" — exactly the existence signal R2 and binding
  decision 2 forbid, and exactly what Q4 tests with direct API probes. Practical disclosure is
  limited: no P005 response ever hands a client a time-entry UUID and v4 UUIDs are not
  enumerable, so this is a defense-in-depth failure rather than an active data leak. I rate it
  High because it is a reproducible violation of a binding decision and it contradicts the
  shipped contract text.
- **Recommended correction:** Resolve the entry's request context in `WorkService.voidTimeEntry`
  (or return a distinct repository outcome) and throw `notFound()` when the role lacks
  `VIEW_PRIVATE_TIME`. Keep `403` for internal roles that can view but lack the specific void
  authority — a developer voiding another author's entry must stay `403` per Q4 and the existing
  V11 assertion.

### P005-F2 — Private-time create route returns 403 to client roles while the list route returns 404

- **Severity:** Medium
- **Requirement affected:** R2 (no private-time existence signal for client roles); R6 (consistent
  `403`/`404` semantics); AC3.
- **Evidence:** [service.ts:146-148](apps/api/src/modules/work/service.ts#L146-L148) checks
  `canCreateTime` and throws `forbidden()` with no preceding `VIEW_PRIVATE_TIME` gate, whereas
  [service.ts:125-127](apps/api/src/modules/work/service.ts#L125-L127) on the same collection
  throws `notFound()` for the same roles.
- **Reproduction (probe B):** as `CLIENT_ADMIN` against the in-progress fixture,
  `POST /api/v1/change-requests/{id}/time-entries` → `403`;
  `GET /api/v1/change-requests/{id}/time-entries` → `404`.
- **Impact:** Lower than P005-F1 — no individual row is implied, and the route's existence is a
  static property of the API rather than tenant data. But two verbs on one collection now answer
  inconsistently for the same caller, which undercuts the "no private-time surface for client
  roles" contract and makes the intended rule harder to reason about and to test.
- **Recommended correction:** Apply the same `VIEW_PRIVATE_TIME` → `notFound()` gate before the
  `CREATE_PRIVATE_TIME` check. Fixing this with P005-F1 yields one consistent rule: client roles
  receive `404` on every private-time route; internal roles receive `403` only when they lack the
  specific action.

### P005-F3 — Void controls and both paginators have no automated UI coverage

- **Severity:** Medium
- **Requirement affected:** AC22 ("internal work/time controls, totals, **void permissions**,
  conflict recovery, and handoff creation match current capabilities"); AC24 ("complete history,
  **time pagination**, workflow actions ... remain keyboard-accessible"); AC27; and the P005
  section added to [TESTING.md](markdown/TESTING.md), which states component tests cover
  "role-aware work, time, review, cancellation, history".
- **Evidence:** [WorkSection.test.tsx](apps/web/src/features/work/WorkSection.test.tsx) contains
  five tests: client read-only history, start-work, time creation with a preserved-input `409`,
  review-response validation, and cancellation confirmation. None renders an existing time entry,
  so the void branch at
  [WorkSection.tsx:185-272](apps/web/src/features/work/WorkSection.tsx#L185-L272) — the
  `canManage` versus `canVoidOwn && authorUserId === self` matrix, the inline confirm form, and
  its `409` recovery — is never exercised. Neither paginator
  ([WorkSection.tsx:277-297](apps/web/src/features/work/WorkSection.tsx#L277-L297) and
  [WorkSection.tsx:823-843](apps/web/src/features/work/WorkSection.tsx#L823-L843)) is exercised.
  The Playwright flow also never voids or paginates.
- **Impact:** The API-side void authority is very well covered, so this is an affordance and
  support-burden risk, not a security hole — a regression that rendered **Void entry** on another
  author's entry for a developer would fail no test, though the API would still reject the call
  with `403`. It also means Q4 and Q10 carry more manual weight than the recorded evidence
  implies.
- **Recommended correction:** Add component tests that (a) render an active entry authored by a
  different user with `canVoidOwn: true, canManage: false` and assert no void control,
  (b) render an own entry, open the confirm form, and assert the exact `voidTimeEntry` payload
  plus `409` recovery, and (c) exercise one paginator's next/previous transition.

### P005-F4 — `respondToHandoff` omits `organization_memberships` from its row lock

- **Severity:** Low
- **Requirement affected:** The invariant "services own capabilities and transition policy;
  repositories execute scoped queries and transaction locks"; internal consistency with the other
  five P005 mutations.
- **Evidence:** [repository.ts:415](apps/api/src/modules/work/repository.ts#L415) uses
  `.for('update', { of: [changeRequests, workReviewHandoffs] })`, while
  [repository.ts:167](apps/api/src/modules/work/repository.ts#L167),
  [229](apps/api/src/modules/work/repository.ts#L229),
  [284](apps/api/src/modules/work/repository.ts#L284),
  [326](apps/api/src/modules/work/repository.ts#L326), and
  [481](apps/api/src/modules/work/repository.ts#L481) all lock
  `[changeRequests, organizationMemberships]`.
- **Impact:** A membership suspension committing in the narrow window between the response
  transaction's membership read and its commit is not serialized against that response. The
  request-row lock bounds the window to a single in-flight transaction and the membership read is
  a fresh `READ COMMITTED` snapshot, so exposure is very small. This is an inconsistency in an
  otherwise uniform locking discipline rather than a demonstrated defect.
- **Recommended correction:** Add `organizationMemberships` to the `of` list for parity.

### P005-F5 — Seed lifecycle fixtures skip the initial `SUBMITTED` history row

- **Severity:** Low
- **Requirement affected:** R8 ("Extend deterministic fake seed data with in-progress,
  ready-for-review, completed, cancelled ... scenarios"); AC26; Q9's "internal completeness" check.
- **Evidence:** The four new requests in [seed.ts](packages/database/src/seed.ts)
  (`requestInProgress`, `requestReadyForReview`, `requestCompleted`, `requestCancelled`) receive
  only their P005 transition rows. The application always writes an initial `SUBMITTED` row in the
  creation transaction
  ([change-requests/repository.ts:103-105](apps/api/src/modules/change-requests/repository.ts#L103-L105)),
  and `requestCancelled` records `SUBMITTED -> CANCELLED` with no event that put it in
  `SUBMITTED`. `requestCompleted` likewise has an `IN_PROGRESS -> READY_FOR_REVIEW` row with no
  preceding `APPROVED -> IN_PROGRESS`.
- **Reproduction (probe D):** internal history for the completed fixture returns eight events, the
  earliest at `2026-07-27T13:00:00.000Z`, with no creation or start event.
- **Impact:** The fixtures are deterministic and idempotent and every dependent test passes, so
  nothing is broken. But a QA operator inspecting the seeded chronology during Q9 sees a history
  no real request could produce, which makes "internal history is complete" harder to confirm
  from the seed alone.
- **Recommended correction:** Add the missing initial `SUBMITTED` rows, and for the completed and
  ready-for-review fixtures the intermediate `APPROVED -> IN_PROGRESS` row, with fixed IDs and
  timestamps.

### P005-F6 — History read model materializes every source row per page

- **Severity:** Low
- **Requirement affected:** Maintainability. R5's ordering and pagination contract is satisfied,
  so this is forward-looking only.
- **Evidence:** [`historySources`](apps/api/src/modules/work/repository.ts#L541-L635) issues six
  unbounded queries for the request, and [service.ts:341](apps/api/src/modules/work/service.ts#L341)
  slices the assembled array in memory. Every page request therefore reads the request's entire
  status, estimate, response, comment, handoff, and time history.
- **Impact:** None at P005's local scale, and the design is precisely what makes "filter before
  ordering, pagination, and counting" easy to verify — which is why I am not asking for it to
  change now. It does mean per-page cost grows linearly with total request history, so a
  long-lived request with heavy time logging will get progressively slower.
- **Recommended correction:** Accept for P005 and record it as a known scaling characteristic. If
  a later phase reports slow request detail, bound the source queries or move ordering into SQL.

## Checklist Notes

- **Scope discipline.** No AWS SDK, Cognito, Amplify, Stripe, queue, scheduler, cron, billing,
  invoicing, payroll, timer, assignment, notification, outbox, or webhook code or dependency
  entered the diff. No reopen, restore, arbitrary status patch, time edit, or time hard-delete
  route exists.
- **Strict TypeScript.** No `any` and no unsafe assertion was introduced. The two non-null
  assertions ([service.ts:353](apps/api/src/modules/work/service.ts#L353) and the array index at
  [service.ts:116](apps/api/src/modules/work/service.ts#L116)) are each guarded by a preceding
  length or filter check.
- **Package boundaries.** `packages/shared` gained only Zod schemas and types and imports no
  Express, browser, or driver code. The `work` module follows the established routes → service →
  repository split; no base class or generic framework was added.
- **Envelopes and correlation.** All eight routes return the standard `{ data, meta }` envelope,
  reuse the shared error mapper, and carry `requestId`. `meta.count` is page length, matching the
  established P004 convention at
  [comments/service.ts:44](apps/api/src/modules/comments/service.ts#L44) — consistent, not a
  finding.
- **Accessibility.** Sections use `aria-labelledby`, controls carry visible labels, errors use
  `role="alert"` with `aria-invalid`, and success/error feedback receives focus. Full keyboard and
  narrow-viewport confirmation remains Q10's responsibility.
- **Human QA.** Q1–Q10 have not run. Q4 in particular should be executed after P005-F1 and
  P005-F2 are dispositioned, since it tests exactly that behavior.

## Verdict

`changes requested`

P005 is a strong, well-structured implementation. The transition graph, transactional status
history, versioned handoff/response model, concurrency handling, additive migration, and
history filtering-before-pagination are all correct and independently verified, and every
validation result recorded in the handoff reproduced exactly on my machine. The single High
finding (P005-F1) is a narrow but reproducible violation of a binding P005 decision that the
shipped API contract already claims is handled; its fix is small and local, and P005-F2 shares
the same fix site. I recommend correcting P005-F1 and P005-F2 together, dispositioning P005-F3
through P005-F6, and rerunning V11, V12, and V20 before human QA.
