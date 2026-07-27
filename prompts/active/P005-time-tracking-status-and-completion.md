---
phase: P005
spec_version: 1
status: approved
approved_by: human
approved_date: 2026-07-27
drafted_date: 2026-07-27
last_verified_sha: 33e233130579cc4be479e588bc1229f2a8a94579
---

# P005 — Time Tracking, Status, And Completion

> Approved by the human on 2026-07-27, including all fifteen binding decisions.
> This is the canonical P005 implementation work order, revalidated against
> authoritative local `main` at
> `33e233130579cc4be479e588bc1229f2a8a94579`.

## Problem

P001 through P004 now provide tenant-safe requests, access administration,
exact estimate approval, and visibility-safe conversation. The approved request
is still not executable through a controlled delivery workflow:

- `APPROVED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `COMPLETED`, and `CANCELLED`
  exist in the shared and PostgreSQL enums, but P005 transitions do not exist;
- `time_entries` and `status_history` are scaffolded, but time has no shared
  contract, capability, API, correction lifecycle, totals, or UI;
- the system cannot preserve a structured work summary or release notes when
  work is handed to the client for review;
- no client action accepts completed work or requests another work cycle;
- request history is split across request, estimate, comment, and status data
  with no complete role-filtered chronology;
- the current roadmap does not resolve whether time is client-visible, who can
  change which statuses, how mistakes are corrected, or whether terminal
  requests can reopen.

P005 must close those gaps without turning time into billing, weakening the
P003 approval boundary, exposing internal work detail, or entering attachments,
notifications, production authentication, AWS, deployment, or accounting.

## Outcome

On the fully local stack:

1. approved requests follow one explicit work lifecycle from start through
   versioned client review and completion;
2. internal service roles can record durable private time while a request is in
   progress, correct mistakes by voiding rather than deleting history, and see
   active totals;
3. each review handoff preserves an immutable work summary and optional release
   notes, including repeated change-requested cycles;
4. `CLIENT_ADMIN` explicitly accepts a current handoff or requests changes with
   a durable response; `CLIENT_MEMBER` remains read-only;
5. authorized administrators can cancel a nonterminal request with a durable
   client-visible reason, while completed and cancelled requests stay terminal;
6. every authorized viewer receives a deterministic request chronology, with
   estimate drafts, internal comments, and private time filtered before
   pagination according to existing capabilities;
7. the request detail UI presents work, review, time, and history states with
   accessible validation, conflict, success, failure, and responsive behavior;
8. P001 request, P002 access, P003 estimate, and P004 conversation behavior
   remain intact.

## Current Repository Evidence

- Draft basis: authoritative local `main` at
  `33e233130579cc4be479e588bc1229f2a8a94579`.
- P001 through P004 are complete, independently reviewed, human-QA passed, and
  locally integrated.
- `change_request_status` already contains the P005 statuses `IN_PROGRESS`,
  `READY_FOR_REVIEW`, `COMPLETED`, and `CANCELLED`.
- P003 alone currently moves requests through estimate lifecycle states and
  ends approval at `APPROVED`.
- `status_history` stores request, actor, previous/new status, optional note,
  and creation time; it has no public API or complete-history UI.
- `time_entries` stores request, user, positive integer minutes, description,
  work date, and timestamps; it has no validation beyond positive duration and
  no void/correction fields.
- There is no work-handoff or work-review-response table.
- The centralized policy has no time, work-transition, work-review, history, or
  cancellation capabilities.
- Request detail currently composes request facts, P003 estimates, and P004
  comments. The web API has no P005 methods.
- Existing tenant enforcement requires an active user, active client
  organization/project, and active membership in that client organization;
  internal organization membership alone grants nothing.
- P003 filters drafts before client DTO mapping. P004 filters internal comments
  before client pagination/counting and safely serializes request errors.
- The product audit explicitly left client visibility of time entries and
  reopening after completion for a later decision.
- No new dependency, environment variable, AWS service, or external integration
  is needed for the P005 outcome.

Codex must revalidate every claim and record the exact implementation base SHA
after human approval.

## Requirements

### R1 — Centralize Work, Time, Review, History, And Cancellation Capabilities

- Add typed capabilities for viewing authorized request history, viewing and
  creating private time, voiding own time, managing all private time, managing
  request work, responding to work review, and cancelling requests.
- Every active client-tenant role may view the request history that is visible
  to that role.
- `OWNER`, `ADMIN`, and `DEVELOPER` may view/create private time and manage
  request work.
- `DEVELOPER` may void only their own active time entries. `OWNER` and `ADMIN`
  may void any active time entry in the authorized client tenant.
- Only `CLIENT_ADMIN` may accept a review handoff or request another work cycle.
- `OWNER`, `ADMIN`, and `CLIENT_ADMIN` may cancel an eligible nonterminal
  request. `DEVELOPER` and `CLIENT_MEMBER` may not cancel.
- Internal AppSolo organization membership grants no implicit access to client
  work, time, review, cancellation, or history.
- Every read and write rechecks active user, client organization, project,
  membership, capability, and request scope in the API service/repository path.

### R2 — Record Private Time With Durable Void Corrections

- Time creation accepts exactly `durationMinutes`, `description`, and
  `workDate`; request, actor, ID, timestamps, active/void state, and totals are
  server-owned.
- Duration is an integer from 1 through 1,440 minutes. Description is trimmed,
  PostgreSQL-safe text from 3 through 2,000 characters. Work date is a valid
  `YYYY-MM-DD` calendar date.
- The authenticated internal actor records time only for themself; no API field
  may select another user.
- Time may be created only while the request is exactly `IN_PROGRESS`.
- Existing and new time entries have no edit or hard-delete API. A correction
  voids one active entry with a trimmed required reason of 3 through 2,000
  characters and `expectedUpdatedAt`; a replacement is a separate new entry.
- Voiding preserves the original duration, description, work date, creator,
  creation time, void actor, void reason, and void time.
- Concurrent or stale void attempts produce one success and safe
  `409 CONFLICT`; no double void or partial change occurs.
- Active totals exclude voided entries. History retains both creation and void
  facts.
- Past time remains attributed after its author's membership suspension, but a
  suspended actor immediately loses new read/write capability.
- Private time rows, totals, dates, authors, voids, counts, timing, and
  existence are never returned to client roles.

### R3 — Enforce One Explicit Request Work Transition Graph

P005 owns only these new lifecycle commands:

```text
APPROVED
  -> IN_PROGRESS                 internal work manager starts work

IN_PROGRESS
  -> READY_FOR_REVIEW            internal work manager creates a handoff

READY_FOR_REVIEW
  -> IN_PROGRESS                 client administrator requests changes
  -> COMPLETED                   client administrator accepts completion

eligible nonterminal state
  -> CANCELLED                   owner/admin/client administrator cancels
```

- P003 remains the sole owner of estimate draft, submission, approval,
  rejection, clarification, revision, supersession, and transitions through
  `APPROVED`.
- Starting work accepts only `expectedUpdatedAt` and moves only
  `APPROVED -> IN_PROGRESS`.
- Ready-for-review and response transitions follow R4.
- Cancellation accepts a required 3–2,000 character client-visible reason plus
  `expectedUpdatedAt`. The eligible source states are `SUBMITTED`,
  `AWAITING_ESTIMATE`, `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`,
  `NEEDS_CLARIFICATION`, `IN_PROGRESS`, and `READY_FOR_REVIEW`; unused request
  `DRAFT`, `COMPLETED`, and `CANCELLED` are not eligible.
- `COMPLETED` and `CANCELLED` are terminal in P005. There is no reopen, restore,
  or arbitrary status override.
- Cancellation preserves every estimate row, term, version, response, and
  status as immutable history, but freezes any remaining draft edit/submission
  or submitted-estimate response action. The API returns conflict and the UI
  shows retained read-only history rather than stale action controls.
- No route accepts a caller-chosen generic destination status.
- Each successful transition atomically updates the request and inserts exactly
  one immutable status-history row with authenticated actor and exact
  previous/new states.
- Stale timestamps, repeated commands, invalid actors, and invalid source
  states return safe errors without a state or history change.

### R4 — Preserve Versioned Work Handoffs And Explicit Client Responses

- Moving `IN_PROGRESS -> READY_FOR_REVIEW` creates one immutable,
  request-numbered work handoff in the same transaction as the status/history
  transition.
- A handoff contains a required trimmed 10–5,000 character work summary and
  optional trimmed 3–5,000 character release notes, plus server-owned request,
  version, actor, ID, and creation time.
- A request may have only one current unanswered handoff and versions increase
  by one without gaps under concurrency.
- `CLIENT_ADMIN` responds to the current handoff with exactly `ACCEPT` or
  `REQUEST_CHANGES`, a current request timestamp, and a note.
- Acceptance permits an optional trimmed completion note up to 2,000
  characters and moves `READY_FOR_REVIEW -> COMPLETED`.
- Requesting changes requires a trimmed 3–2,000 character reason and moves
  `READY_FOR_REVIEW -> IN_PROGRESS`.
- A response is immutable and unique per handoff. Concurrent responses produce
  at most one success.
- A later handoff after requested changes receives the next version. Every
  earlier summary, release note, response, actor, timestamp, and status
  transition remains visible.
- `CLIENT_MEMBER` and internal roles may read shared handoffs/responses but
  cannot respond through P005.

### R5 — Expose A Complete Authorized Request Chronology

- Add one deterministic, paginated history endpoint for a change request.
- The chronology is oldest-first and uses event time, a stable event-kind
  ordering key, and source ID as deterministic tie-breakers.
- Tagged history items cover:
  - initial request/status history and later status transitions;
  - estimate submission events and immutable client responses; mutable drafts
    are current working state in the dedicated estimate section, not history
    events for any role;
  - comments visible under the current P004 visibility capability;
  - time creation and void facts for internal roles only;
  - work handoffs and immutable client work-review responses.
- Existing dedicated estimate and comment sections remain authoritative for
  their workflows; the chronology is a read model and never mutates source
  records.
- Authorization and visibility filtering occur before ordering, pagination,
  counting, or DTO construction.
- Client roles receive no private-time or internal-comment row, ID, count,
  offset gap, placeholder, empty-state distinction, or other existence signal;
  P003 draft redaction remains unchanged outside the chronology.
- Internal-only comments retain their explicit label for internal viewers.
- History DTOs use explicit tagged shapes, safe actor display names, and
  application-owned fields only; no email, membership row, raw database row,
  token, credential, SQL detail, or unrelated tenant data is returned.
- Past events remain attributed after an actor's membership suspension,
  according to the current viewer's authorization.

### R6 — Expose Strict Versioned P005 API Contracts

Implement and document:

- `GET /api/v1/change-requests/:changeRequestId/time-entries`;
- `POST /api/v1/change-requests/:changeRequestId/time-entries`;
- `POST /api/v1/time-entries/:timeEntryId/void`;
- `POST /api/v1/change-requests/:changeRequestId/work/start`;
- `POST /api/v1/change-requests/:changeRequestId/review-handoffs`;
- `POST /api/v1/review-handoffs/:handoffId/respond`;
- `POST /api/v1/change-requests/:changeRequestId/cancel`;
- `GET /api/v1/change-requests/:changeRequestId/history`.

Contract rules:

- preserve `/api/v1`, standard success/error envelopes, request IDs, and the
  provider-neutral authenticated context;
- list routes accept strict `limit`/`offset`, default 50/0, maximum 100;
- time lists order by work date descending, then creation time and ID
  descending, and return current active-minute totals only to internal roles;
- history follows the stable oldest-first ordering in R5;
- all bodies are strict and reject unknown or server-owned fields;
- create returns `201`; commands return the resulting explicit DTO/read model;
- missing and inaccessible request or nested IDs share `404 NOT_FOUND`;
- a known authorized collection whose actor lacks an action capability returns
  `403 FORBIDDEN` without mutation;
- stale or invalid lifecycle state returns `409 CONFLICT`;
- validation uses safe field-specific `400 VALIDATION_ERROR`;
- time descriptions, void reasons, work summaries, release notes, cancellation
  reasons, and review notes never enter logs or unsafe error output.

### R7 — Deliver An Accessible Role-Aware Work And History UI

- Extend request detail with a work-status section, work-review section,
  role-authorized actions, and complete history.
- Internal work managers see **Start work** only for `APPROVED` and a review
  handoff form only for `IN_PROGRESS`.
- Internal roles receive a private-time section only while authorized. It shows
  active totals, active/voided entries, creation, void reason/actor, loading,
  empty, pagination, validation, success, conflict, and failure states.
- Developers can void their own entries; owner/admin controls reflect their
  broader capability. Controls are not rendered for unauthorized actors, while
  the API remains the enforcement boundary.
- On `READY_FOR_REVIEW`, every authorized viewer sees the current immutable
  handoff. `CLIENT_ADMIN` receives accept/request-changes actions;
  `CLIENT_MEMBER` remains read-only.
- Completion clearly identifies the accepted handoff and optional completion
  note. Requested changes clearly return the request to in-progress without
  overwriting the earlier handoff.
- Eligible cancellation is explicit, requires confirmation and a reason, and
  never appears as an arbitrary status selector.
- Client roles receive no private-time component, loading state, count, total,
  marker, placeholder, spacing artifact, or inaccessible-control hint.
- The complete chronology renders tagged event labels, visibility labels where
  applicable, actors, timestamps, and readable content with stable pagination.
- Mutations preserve recoverable input on validation, permission, conflict,
  network, and server errors; success/error feedback is focused or announced.
- All controls remain keyboard-operable with visible labels, focus, logical
  order, readable wrapping, and narrow-viewport usability.

### R8 — Apply Additive Data Integrity, Immutability, And Seed Protections

- Use additive checked-in Drizzle migrations and matching snapshots.
- Preserve all existing requests, estimates, responses, comments, status
  history, time entries, attachments, users, memberships, and seed IDs.
- Add bounded duration and description checks plus deterministic ID tie-breaker
  indexes to `time_entries`.
- Add nullable void actor/reason/time fields with an all-null-or-all-present
  database invariant; there is no hard-delete or general update route.
- Add immutable request-versioned work-handoff and one-response-per-handoff
  tables with restrictive foreign keys, text checks, timestamps, deterministic
  indexes, and concurrency-safe uniqueness.
- Strengthen status-history note validity and deterministic ordering without
  rewriting existing rows.
- Keep request status and its new status-history row atomic for start, handoff,
  response, and cancellation operations.
- Extend deterministic fake seed data with in-progress, ready-for-review,
  completed, cancelled, active/voided time, repeated handoff, other-tenant, and
  suspended-author scenarios.
- Keep seed execution twice-idempotent, guarded local reset behavior, strict
  development/test separation, and no destructive migration rewrite.

### R9 — Preserve Regression, Documentation, And Review Evidence

- Preserve all P001 request create/list/detail and tenant-denial contracts.
- Preserve all P002 session/invitation/membership/audit contracts and immediate
  suspension enforcement.
- Preserve all P003 estimate arithmetic, draft redaction, response, revision,
  supersession, concurrency, and history contracts.
- Preserve all P004 comment visibility, filtering-before-pagination,
  clarification continuity, safe default, append-only behavior, and log
  redaction.
- Add meaningful shared/database unit, PostgreSQL API integration, React
  component, and real Playwright coverage.
- Update API, data, security, testing, architecture, README, and accepted ADR
  documentation where approved behavior changes.
- Record every validation result as `Passed`, `Failed`, or `Not run` with exact
  commands, counts, or reasons.
- Create an immutable candidate commit and
  `notes/P005/implementation-handoff.md`.
- Advance P005 only through the normal review lifecycle; Codex must not mark it
  complete.

## Acceptance Criteria

- AC1 maps to R1: session/member capability DTOs expose the exact P005 role
  matrix and every P005 API independently enforces it.
- AC2 maps to R1: other-tenant, internal-only, suspended-membership,
  globally-suspended-user, inactive-project/organization, and inaccessible-ID
  cases cannot read or mutate P005 resources.
- AC3 maps to R1/R2: internal roles can view/create private time; developers
  void only their own entries; owner/admin can void any authorized entry; both
  client roles receive no private-time output or capability.
- AC4 maps to R2: a valid time entry is normalized and persisted once with
  server-owned request, actor, ID, and timestamps while the request is
  `IN_PROGRESS`.
- AC5 maps to R2/R8: zero, negative, fractional, over-1,440, invalid-date,
  empty, whitespace, over-limit, null-character, non-string, unknown, and
  server-owned fields are rejected by appropriate API/database boundaries.
- AC6 maps to R2: voiding preserves the original row and records actor, reason,
  time, and optimistic version; stale/concurrent repeats produce one outcome.
- AC7 maps to R2: active totals use integer minutes, exclude voided entries,
  remain stable across pagination, and never imply billing or estimate cost.
- AC8 maps to R3: only the exact approved work-transition graph succeeds; no
  generic destination or unrelated transition is reachable.
- AC9 maps to R3: every successful command updates the request and inserts
  exactly one matching status-history row atomically.
- AC10 maps to R3: stale, repeated, invalid-source, and unauthorized commands
  leave request state and history unchanged.
- AC11 maps to R3: cancellation requires an allowed actor, nonterminal request,
  current timestamp, eligible exact source state, and durable reason;
  draft/completed/cancelled requests cannot transition.
- AC12 maps to R3: all P003 estimate states, terms, responses, revision rules,
  and approval authority remain unchanged; request cancellation retains but
  freezes any otherwise-actionable estimate without rewriting it.
- AC13 maps to R4: ready-for-review atomically creates one immutable numbered
  handoff with validated summary/release notes and one status transition.
- AC14 maps to R4: only `CLIENT_ADMIN` can accept or request changes;
  `CLIENT_MEMBER` and internal roles are read-only for responses.
- AC15 maps to R4: change requests require a reason and return to
  `IN_PROGRESS`; later handoff versions preserve every earlier handoff and
  response.
- AC16 maps to R4: acceptance produces one immutable response and one
  `COMPLETED` transition with optional completion note; concurrent responses
  yield at most one success.
- AC17 maps to R5: authorized history contains every applicable tagged source
  event exactly once in stable oldest-first order across pagination and
  equal-time fixtures.
- AC18 maps to R5: drafts are never chronology events, and client history omits
  internal comments and all time facts before ordering/pagination without a
  count, gap, ID, or timing oracle.
- AC19 maps to R5: safe DTOs preserve historical attribution after actor
  suspension without exposing email, membership/user state, raw rows, or other
  tenants.
- AC20 maps to R6: all eight routes use strict path/query/body validation,
  standard envelopes/correlation, exact status codes, and documented ordering.
- AC21 maps to R6: P005 free-text bodies and internal content are absent from
  client errors and captured application logs, including forced database
  failures.
- AC22 maps to R7: internal work/time controls, totals, void permissions,
  conflict recovery, and handoff creation match current capabilities.
- AC23 maps to R7: client-admin review/cancellation and client-member read-only
  states are clear, while both client roles receive no private-time artifact.
- AC24 maps to R7: complete history, time pagination, workflow actions,
  validation, success, conflict, network, and server-error states remain
  keyboard-accessible and usable at a narrow viewport.
- AC25 maps to R8: the additive migration preserves existing rows, enforces
  void/text/duration/handoff integrity, and produces no Drizzle drift.
- AC26 maps to R8: seed is twice-idempotent and supplies deterministic lifecycle,
  time, handoff, completion, cancellation, suspended-author, and cross-tenant
  fixtures.
- AC27 maps to R9: shared, database, API, component, and Playwright tests cover
  validation, role/tenant denial, concurrency, redaction/oracle resistance,
  transitions, repeated review, completion, and P001-P004 regressions.
- AC28 maps to R9: contracts, exact SHAs, validation evidence, candidate
  handoff, and prohibited-scope searches are complete.

## Proposed Binding Decisions For Human Approval

The human approved all fifteen decisions below without revision on 2026-07-27.

1. **One cohesive phase:** P005 keeps time, controlled work states, versioned
   review handoff, completion, cancellation, and authorized history together
   because they form one transactional delivery workflow.
2. **Private time:** individual time rows, totals, dates, descriptions, authors,
   and void history are internal-only; client roles receive no existence signal.
3. **Time actors:** `OWNER`, `ADMIN`, and `DEVELOPER` log only their own time;
   developers void only their own entries, while owner/admin may void any entry
   in the authorized tenant.
4. **Durable correction:** time has create-and-void lifecycle only. There is no
   edit or hard-delete; corrections void the original with a reason and create
   a replacement.
5. **Time availability:** time can be recorded only while a request is exactly
   `IN_PROGRESS`.
6. **Time bounds:** each entry is 1–1,440 integer minutes with a 3–2,000
   character description and a valid calendar work date.
7. **Work transition graph:** P005 adds only
   `APPROVED -> IN_PROGRESS -> READY_FOR_REVIEW`, with client-requested changes
   returning `READY_FOR_REVIEW -> IN_PROGRESS`.
8. **Client completion authority:** only `CLIENT_ADMIN` accepts the current
   handoff and moves `READY_FOR_REVIEW -> COMPLETED`; client members and
   internal roles cannot self-accept.
9. **Versioned handoff:** every ready-for-review transition creates an immutable
   numbered handoff with required work summary and optional release notes.
10. **Immutable review response:** each handoff receives at most one immutable
    `ACCEPTED` or `CHANGES_REQUESTED` response; changes require a reason.
11. **Cancellation:** `OWNER`, `ADMIN`, and `CLIENT_ADMIN` may cancel
    `SUBMITTED`, `AWAITING_ESTIMATE`, `AWAITING_APPROVAL`, `APPROVED`,
    `REJECTED`, `NEEDS_CLARIFICATION`, `IN_PROGRESS`, or `READY_FOR_REVIEW`
    with a client-visible reason; developer/client member cannot cancel, and
    retained estimates become read-only without status/term rewriting.
12. **Terminal states:** `COMPLETED` and `CANCELLED` do not reopen in P005.
13. **Complete chronology:** one paginated oldest-first read model combines
    authorized status, estimate, comment, time, handoff, and response events
    while existing workflow sections remain.
14. **History oracle:** mutable estimate drafts are not chronology events;
    internal comments and private time are filtered before history
    ordering/pagination/counting for client roles.
15. **Notification boundary:** P005 records durable source rows only; P007 owns
    event outbox, preferences, templates, email, and delivery.

## Suggested Approach

Non-binding implementation direction:

- extend the centralized capability policy instead of embedding role checks in
  route handlers;
- add focused `work`, `time-entries`, and request-history modules, sharing one
  tenant-scoped request-context helper where it reduces real duplication;
- use command-specific routes rather than a generic status patch;
- lock the request and current handoff/entry rows during transitions and
  optimistic checks;
- represent time totals with integer minutes and format hours only for display;
- add void metadata to the existing `time_entries` scaffold rather than
  replacing it;
- add immutable handoff/response tables using the proven P003 version/response
  pattern;
- build the mixed history read model from explicit source projections with
  authorization filtering before deterministic pagination;
- compose focused React sections on request detail using TanStack Query,
  accessible forms/feedback, and existing CSS-module/design-token conventions.

Codex must inspect the approved base and may choose a simpler implementation
that satisfies every binding requirement and criterion.

## Invariants

- Active user, active client organization, active project, and active
  client-organization membership are required for every P005 operation.
- Internal AppSolo membership alone never grants client access.
- Services own capabilities and transition policy; repositories execute scoped
  queries and transaction locks.
- Frontend control hiding is never authorization or redaction evidence.
- Private time and its existence never reach client roles.
- P003 remains the only estimate approval/revision authority.
- P004 comments remain append-only and available independently of request
  status; no P005 action rewrites comment content or visibility.
- Every request status change and matching status-history row commit together.
- Work handoffs and review responses are immutable.
- Completed and cancelled requests remain terminal in P005.
- Free-text work/time/review bodies never enter application logs or unsafe
  error output.
- Existing records are preserved; no hard-delete API or destructive migration
  is introduced.
- Development and test databases remain separate.
- Strict TypeScript remains enabled; avoid `any`.
- No AWS or external service is required.

## Non-Goals

- NG1: Billing, invoicing, hourly billing rates, estimate-versus-actual cost,
  taxes, discounts, payroll, contractor payment, or accounting export.
- NG2: Running timers, stopwatch state, background tracking, automatic idle
  detection, browser activity capture, or calendar synchronization.
- NG3: Time-entry edit/hard-delete, bulk import, approval, categories, tags,
  expenses, mileage, utilization, or reporting dashboards.
- NG4: Request assignment, assignees, sprint planning, queues, dependencies,
  due-date automation, SLA policy, or general project-management features.
- NG5: Arbitrary status patching, custom statuses, workflow builders,
  completed/cancelled reopening, restore, or retroactive history mutation.
- NG6: A second estimate approval path, alternate estimate approvers, estimate
  withdrawal, line items, or pricing changes.
- NG7: Comment editing, deletion, threading, moderation, reactions, or changing
  P004 visibility behavior.
- NG8: Project-level status/completion automation or organization-level history.
- NG9: Attachment upload/download behavior, review attachments, or S3 from
  P006.
- NG10: Notification outbox/preferences/templates, email, SES, digests,
  webhooks, queues, or delivery from P007.
- NG11: Cognito, passwords, JWTs, production sessions, or account recovery from
  P008.
- NG12: AWS resources/SDKs, deployment, production containers, CI/CD,
  background jobs, or production hardening.
- NG13: Real-time subscriptions, WebSockets, server-sent events, presence, or
  live collaborative review.
- NG14: Client-visible individual time, client time entry, client time approval,
  or a claim that internal time is billable.

## Likely Affected Areas

- `packages/shared`: P005 capabilities, strict time/work/review/history schemas,
  tagged DTOs, and transition commands.
- `packages/database`: additive time void constraints/indexes, immutable
  handoff/response tables, status-history integrity, migration/snapshot, seed,
  and database tests.
- `apps/api`: work/time/history routes, services, repositories, centralized
  policy, transaction/concurrency handling, composition, and integration tests.
- `apps/web`: API client, work/time/review/history sections, role-aware controls,
  responsive styles, and component tests.
- `e2e`: real start/time/handoff/change-cycle/completion flow plus direct
  redaction and P001-P004 regressions.
- `markdown/`, `README.md`, and `notes/P005/`: contracts and delivery evidence.

## Data And Migration Impact

- Schema change: additive void metadata/checks/index refinements on
  `time_entries`, status-history integrity/index refinement, and new immutable
  handoff/response tables plus any required enum.
- Backward compatibility: preserve every existing row and public P001-P004
  route/DTO behavior; the existing status enum is reused without reordering.
- Rollback/recovery: checked-in forward migration; no destructive automatic
  rollback or reset.
- Seed/test data: add deterministic work lifecycle, time void, repeated handoff,
  completion, cancellation, cross-tenant, and suspended-author fixtures.

## Dependencies And Environment

- New dependencies: none proposed.
- Runtime/tooling: preserve the current Node, pnpm, PostgreSQL, Drizzle, React,
  Express, Vitest, and Playwright stack.
- Configuration: no new environment variable is proposed.
- External services: none; implementation and tests remain local and offline.

## Automated Validation

- V1: `node scripts/check-scaffolding.mjs` passes.
- V2: `pnpm install` completes with the intended lockfile state.
- V3: `pnpm docker:up` reaches healthy local PostgreSQL.
- V4: `pnpm db:migrate` applies the additive P005 migration to existing P004
  development data without deleting or rewriting rows.
- V5: `pnpm db:seed` passes twice without duplicate P005 fixtures.
- V6: `pnpm --filter @appsolo/database test:prepare` resets only
  `appsolo_client_hub_test` and reapplies migration/seed.
- V7: `pnpm --filter @appsolo/database generate` reports no schema drift after
  the checked-in migration/snapshot.
- V8: `pnpm lint` passes ESLint and Prettier.
- V9: `pnpm typecheck` passes strict checks in every workspace package.
- V10: `pnpm test` passes shared time/work/review/history schemas, capability
  policy, duration/void checks, handoff immutability, and database constraints.
- V11: `pnpm test:api` passes role/tenant denial, time create/void, totals,
  transition graph, atomic status history, handoff versioning, response
  concurrency, cancellation, history filtering/order, logging, and P001-P004
  regressions against PostgreSQL.
- V12: `pnpm test:web` passes work actions, private time states, void controls,
  client review, cancellation, history pagination/redaction, failures, and
  accessibility component tests.
- V13: `pnpm build` produces all package and web builds.
- V14: `pnpm test:e2e` passes a real approved-to-completed work cycle with
  private time, changes requested, a second handoff, client acceptance, and
  P001-P004 browser regressions against the isolated test database.
- V15: direct database/API probes confirm transaction atomicity, exact
  transition denial, one-response/one-void concurrency, terminal-state
  enforcement, integer totals, and client filtering before history pagination.
- V16: captured structured-log probes confirm time/work/review bodies, internal
  content, credentials, database URLs, sensitive headers, SQL, parameters, and
  full request bodies are absent.
- V17: `node scripts/generate-phase-index.mjs --check` passes.
- V18: `git diff --check <base_sha>..<candidate_sha>` passes.
- V19: repository/manifest searches confirm no P005 non-goal, dependency, AWS
  SDK, Cognito, S3, SES, notification, billing, timer, assignment, queue,
  deployment, or production-session behavior entered the phase.
- V20: `node scripts/validate-phase.mjs P005` passes before review handoff.

Every result must be recorded as `Passed`, `Failed`, or `Not run` with exact
commands and counts or reasons.

## Human QA

- Q1 — Startup/regression: follow the README on the normal development machine;
  confirm Docker/API/web/health and representative P001 request, P002
  access/invitation, P003 estimate/approval, and P004 conversation behavior.
- Q2 — Start work: as a Northstar internal work manager, start an approved
  request, refresh, and confirm one `IN_PROGRESS` transition/history event;
  repeat/stale/unauthorized attempts must fail without another event.
- Q3 — Private time: as each internal role, create valid time while in progress,
  refresh/paginate, verify integer totals, void an allowed entry with a reason,
  create a replacement, and confirm the original remains attributed and voided.
- Q4 — Time denial/redaction: prove a developer cannot void another actor's
  entry while owner/admin can; both client roles and direct API probes receive
  no time row, total, count, placeholder, gap, or existence signal.
- Q5 — Review changes cycle: create a handoff with work summary/release notes,
  request changes as client admin, confirm the request returns to in-progress,
  then create version 2 and verify version 1/history remains immutable.
- Q6 — Completion: accept the current handoff as client admin with an optional
  completion note; confirm one completed transition, terminal behavior,
  persisted history, and read-only client-member/internal response controls.
- Q7 — Cancellation: cancel eligible requests as owner/admin and client admin
  with a reason; confirm developer/client-member denial, atomic history, and no
  cancellation/reopen from completed or cancelled states.
- Q8 — Tenant/lifecycle/concurrency denial: exercise other-tenant,
  internal-only, suspended, inactive-scope, inaccessible-ID, stale timestamp,
  concurrent void, concurrent handoff, and concurrent response cases with safe
  `403`/`404`/`409` behavior and no partial durable state.
- Q9 — Complete history/redaction: create enough mixed equal-time and sequential
  events to paginate; confirm stable oldest-first order, no duplicates/loss,
  internal completeness, and client filtering with no estimate-draft,
  internal-comment, or private-time oracle.
- Q10 — Accessibility/responsive/failure: use keyboard-only navigation and a
  narrow viewport through time pagination, creation/void, start, handoff,
  review response, cancellation, history, validation, success, conflict,
  network, and server-error states; confirm labels, focus, announcements,
  wrapping, confirmation, and recoverable input.

## Deliverables

- Shared P005 capability, input, command, DTO, and history contracts.
- Additive time-void, handoff/response, history-integrity migration and matching
  Drizzle snapshot.
- Tenant-scoped time, work-transition, handoff-response, cancellation, and
  complete-history APIs.
- Accessible role-aware private time, work review, completion, cancellation,
  and history UI.
- Meaningful unit, database, API, component, and Playwright coverage.
- Updated durable contracts, accepted ADRs where needed, README, phase evidence,
  immutable candidate commit, and implementation handoff.

## Open Human Decisions

None. The human approved specification version 1 and all fifteen binding
decisions without revision on 2026-07-27.
