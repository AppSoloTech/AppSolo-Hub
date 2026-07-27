---
phase: P004
spec_version: 1
status: approved
approved_by: human
approved_date: 2026-07-27
drafted_date: 2026-07-27
last_verified_sha: 06c1e0714ea18b1b37173917a45c023220f49e30
---

# P004 — Comments And Clarification

> Approved by the human on 2026-07-27. This is the canonical P004
> implementation work order, revalidated against authoritative local `main` at
> `06c1e0714ea18b1b37173917a45c023220f49e30`.

## Problem

P001 through P003 provide tenant-safe requests, access administration, exact
versioned estimates, and durable client decisions. They do not provide a
request-level communication channel. The database contains an intentionally
unused `comments` table and seeded client-visible/internal-only examples, but
there is no shared comment contract, capability, API, or browser experience.

The current gap matters because:

- clarification discussion can still fragment across external messages after a
  client administrator requests clarification on an estimate;
- internal implementation context has no usable private record;
- client-visible and internal-only content have no API-enforced separation;
- there is no durable ordered conversation after estimate revision or later
  request states;
- future notification work has no stable comment event source;
- hidden frontend controls alone could not prove comment authorization or
  redaction.

P004 must close those gaps without changing P003 estimate decisions or entering
work execution, attachments, notification delivery, production authentication,
AWS, or billing.

## Outcome

On the fully local stack:

1. every active role with active access to a client request can read and add
   client-visible request comments;
2. `OWNER`, `ADMIN`, and `DEVELOPER` can additionally read and add internal-only
   comments for client organizations where they hold active membership;
3. client roles receive no internal-only row, count, author, timing, gap, or
   other existence signal;
4. request comments form a deterministic, durable, append-only-through-the-API
   conversation with explicit authorship and visibility;
5. a P003 clarification request and its immutable reason remain the lifecycle
   trigger, while ordered client-visible comments carry the follow-up
   discussion and remain after estimate revision;
6. the request detail browser experience is role-aware, accessible, responsive,
   and safe by default for internal users;
7. the existing comment table receives additive integrity and ordering
   enforcement plus deterministic, idempotent fixtures;
8. P001 request, P002 access/session, and P003 estimate/approval behavior remain
   unchanged.

## Current Repository Evidence

- Draft basis: authoritative local `main` at
  `a6a3e728e67fa43004bb08d4b64b0e48aec5372f`.
- P001, P002, and P003 are complete, independently reviewed, human-QA passed,
  and locally integrated.
- `comments` already stores request, author, body,
  `CLIENT_VISIBLE`/`INTERNAL_ONLY` visibility, and timestamps with restrictive
  foreign keys.
- The current indexes cover request/time and request/visibility/time, but not an
  ID tie-breaker; the table has no body-length database check.
- Seed data already includes one client-visible and one internal-only comment on
  the same Northstar request.
- There are no comment schemas, DTOs, capabilities, routes, services,
  repositories, component tests, or browser workflows.
- Every active client-organization role currently has
  `VIEW_CHANGE_REQUESTS`; internal service access still requires an explicit
  active membership in the client organization.
- P003 `REQUEST_CLARIFICATION` creates one immutable estimate response, moves
  the estimate and request to `NEEDS_CLARIFICATION`, and permits a later
  numbered estimate revision.
- The request detail UI renders request information and the P003 estimate
  section only.
- Whole request bodies are redacted from application logs, and the security
  contract explicitly prohibits logging comment bodies.
- The roadmap asks P004 for threaded or ordered comments, explicit visibility,
  clarification continuity, and notification-ready events.

Codex must revalidate every claim and record the exact implementation base SHA
after human approval.

## Requirements

### R1 — Centralize Comment Capabilities And Tenant Enforcement

- Add typed `VIEW_COMMENTS`, `CREATE_CLIENT_COMMENTS`,
  `VIEW_INTERNAL_COMMENTS`, and `CREATE_INTERNAL_COMMENTS` capabilities to the
  existing centralized policy.
- Every active `OWNER`, `ADMIN`, `DEVELOPER`, `CLIENT_ADMIN`, and
  `CLIENT_MEMBER` membership in an active client organization receives
  `VIEW_COMMENTS` and `CREATE_CLIENT_COMMENTS`.
- Only `OWNER`, `ADMIN`, and `DEVELOPER` receive
  `VIEW_INTERNAL_COMMENTS` and `CREATE_INTERNAL_COMMENTS`.
- Internal AppSolo organization membership grants no implicit client comment
  access.
- Every comment read and write rechecks active user, organization, project,
  membership, capability, request scope, and requested visibility in the API
  service/repository path.
- Past comments remain attributed and readable according to the current
  viewer's access even when the author's membership later becomes suspended;
  the suspended author cannot authenticate or create/read new content.

### R2 — Define Ordered, Validated, Append-Only Request Comments

- P004 chooses one flat, request-level, chronological conversation rather than
  nested threads.
- Comment bodies are strings, trimmed on input, required after trimming, and
  limited to 1 through 5,000 characters at both the shared/API boundary and
  PostgreSQL check constraint.
- Comment creation accepts exactly `body` and `visibility`; request, author,
  identifiers, timestamps, and all other fields are server-owned.
- The server assigns ID, authenticated author, request, and timestamps.
- List ordering is `createdAt` ascending, then `id` ascending for deterministic
  ties.
- Concurrent valid creates retain both comments and deterministic ordering.
- P004 exposes no edit, delete, restore, reaction, pin, or moderation mutation.
  Existing comment content and visibility are never overwritten through the
  P004 API.
- Comments may be created on any request that remains accessible through the
  active project/client-organization boundary; comment creation itself never
  changes request or estimate state.

### R3 — Enforce Visibility Without A Client Oracle

- `CLIENT_VISIBLE` comments are shared with every authorized active role.
- `INTERNAL_ONLY` comments are returned only to actors with
  `VIEW_INTERNAL_COMMENTS`.
- An actor without `CREATE_INTERNAL_COMMENTS` who submits
  `visibility: INTERNAL_ONLY` receives `403 FORBIDDEN`; no comment is inserted.
- Repository queries apply the visibility predicate before ordering,
  pagination, counting, or DTO construction for client roles.
- A client response contains no internal comment row, body, ID, author,
  timestamp, count, pagination gap, empty-state distinction, or other
  existence signal.
- Client-visible DTOs contain only comment ID, request ID, body, visibility,
  safe author display name, and creation timestamp.
- Internal DTOs use the same explicit shape; visibility is never inferred from
  styling or frontend state.
- Missing and inaccessible request identifiers return the same `404 NOT_FOUND`
  behavior on request-identifier comment routes.

### R4 — Integrate Clarification Without Reopening P003 Decisions

- P003 remains the only owner of estimate approval, rejection,
  `REQUEST_CLARIFICATION`, response reasons, estimate revision, supersession,
  and their request-status transitions.
- A P003 clarification reason remains the immutable initiating record attached
  to its estimate response; P004 must not copy or rewrite it into a comment.
- While a request is `NEEDS_CLARIFICATION`, authorized users can use
  client-visible comments for the follow-up discussion and internal roles can
  separately retain internal-only context.
- The browser clearly relates the clarification state/reason to the request
  conversation and directs users to discuss it without implying that a comment
  resolves the state.
- Posting a comment never resolves clarification, submits a revision, changes
  an estimate, inserts request status history, or performs an arbitrary status
  transition.
- Submitting the later P003 estimate revision remains the only existing path out
  of `NEEDS_CLARIFICATION` in this phase, and all preceding comments remain
  visible under their original visibility after revision/supersession.
- Only `CLIENT_ADMIN` can initiate estimate clarification through the existing
  P003 decision action; comment capability does not grant estimate response
  capability.

### R5 — Expose Strict Versioned Comment API Contracts

Implement and document:

- `GET /api/v1/change-requests/:changeRequestId/comments`;
- `POST /api/v1/change-requests/:changeRequestId/comments`.

Contract rules:

- preserve `/api/v1`, standard success/error envelopes, request IDs, and
  provider-neutral authenticated context;
- list accepts strict `limit` and `offset`, defaulting to 50 and 0, with limits
  of 1 through 100;
- filter authorization and visibility before applying offset/limit;
- list metadata contains returned `count`, `limit`, `offset`,
  `canCreateClientComments`, `canViewInternalComments`, and
  `canCreateInternalComments`, calculated only from the current authorized
  membership;
- create uses the strict shared schema from R2 and returns `201`;
- reject unknown query/body fields and every server-owned field;
- return `403 FORBIDDEN` for an authorized request collection whose actor lacks
  the requested visibility capability;
- return `404 NOT_FOUND` for missing or inaccessible request identifiers so no
  cross-tenant oracle is created;
- use safe field-specific `400 VALIDATION_ERROR` output;
- do not log comment bodies, full request bodies, credentials, database values,
  or internal-only content.

### R6 — Deliver A Role-Aware Accessible Request Conversation UI

- Add a request conversation section to change-request detail with a
  chronological feed, loading, empty, error, pagination, and creation states.
- Every authorized active role can compose a client-visible comment.
- Internal roles receive an explicit visibility choice. It defaults to
  `INTERNAL_ONLY` on every fresh form/reset so sharing with the client requires
  a deliberate choice.
- Client roles have no internal visibility choice, internal loading state,
  internal count, or internal-content artifact; their submitted comments are
  explicitly client-visible.
- Internal-only comments have a persistent text label such as “Internal only”;
  client-visible comments have a persistent label such as “Shared with client.”
  Color alone is insufficient.
- The UI shows author display name and a clear timestamp without exposing raw
  membership or database records.
- Successful creation clears the form, announces success, and invalidates or
  updates only the current request/identity's comment query without duplicating
  the comment.
- Validation, permission, network, and server failures preserve recoverable
  input and provide accessible feedback.
- A `NEEDS_CLARIFICATION` request presents the immutable P003 reason in its
  existing estimate context and explains that discussion can continue below;
  it does not show a false “resolve” control.
- Preserve keyboard operation, visible labels, focus/announcement behavior,
  readable wrapping for long unbroken content, and narrow-viewport usability.

### R7 — Apply Additive Data, Ordering, And Seed Protections

- Use additive checked-in Drizzle migrations and matching snapshots.
- Preserve all existing comment rows and the existing
  `CLIENT_VISIBLE`/`INTERNAL_ONLY` enum.
- Add the body-length/trim check from R2.
- Add or refine request/visibility/created/ID indexes needed for deterministic
  tenant-filtered pagination.
- Keep restrictive foreign keys and add no hard-delete behavior.
- Treat the durable comment row itself as P004's notification-ready event
  source: stable request, author, visibility, ID, and creation time are
  persisted. Do not add an outbox, event bus, notification preference, email,
  or delivery claim before P007.
- Extend deterministic fake seed data with ordered client-visible,
  internal-only, clarification-follow-up, other-tenant, and suspended-author
  history scenarios.
- Keep seed execution twice-idempotent, guarded local reset behavior, and
  strict development/test database separation.

### R8 — Preserve Regression, Documentation, And Review Evidence

- Preserve all P001 request list/detail/create and tenant-denial contracts.
- Preserve all P002 sign-in/session/invitation/membership/audit contracts,
  including capability cache isolation and immediate suspension enforcement.
- Preserve all P003 estimate arithmetic, draft redaction, lifecycle,
  concurrency, response, revision, and history contracts.
- Add meaningful shared/database unit, PostgreSQL API integration, React
  component, and real Playwright coverage.
- Update API, data, security, testing, architecture, README, and accepted ADR
  documentation where approved behavior changes.
- Record exact validation results as `Passed`, `Failed`, or `Not run`.
- Create an immutable candidate commit and
  `notes/P004/implementation-handoff.md`.
- Advance P004 only through the normal review lifecycle; Codex must not mark it
  complete.

## Acceptance Criteria

- AC1 maps to R1: session/member capability DTOs expose the exact comment matrix
  and every comment API independently enforces it.
- AC2 maps to R1: internal-only membership, other-tenant membership, suspended
  membership, inactive project/organization, and globally suspended user cases
  cannot read or create comments.
- AC3 maps to R1/R3: `OWNER`, `ADMIN`, and `DEVELOPER` can read/create both
  visibilities; `CLIENT_ADMIN` and `CLIENT_MEMBER` can read/create only
  client-visible comments.
- AC4 maps to R2: valid bodies are trimmed and persisted once with server-owned
  request, author, ID, and timestamps.
- AC5 maps to R2/R7: empty, whitespace-only, over-limit, non-string, unknown
  field, and direct database invalid-body attempts are rejected.
- AC6 maps to R2: list order is oldest-first with ID tie-breaking, including
  concurrent equal-time fixtures and pagination boundaries.
- AC7 maps to R2: no P004 API can edit, delete, hide, restore, react to, pin, or
  thread an existing comment.
- AC8 maps to R3: client-role API output and metadata contain only
  client-visible rows after filtering and pagination.
- AC9 maps to R3: client responses, UI states, counts, offsets, timing, and
  errors do not disclose seeded or newly created internal-only comments.
- AC10 maps to R3/R5: missing and inaccessible request IDs are indistinguishable
  `404` results, while an authorized internal-visibility attempt without
  capability is `403`.
- AC11 maps to R3: explicit DTOs expose safe display names but no email,
  membership row, user status, unrelated tenant data, or raw database row.
- AC12 maps to R4: a P003 clarification reason remains unchanged and visible in
  estimate history while later client-visible comments document follow-up.
- AC13 maps to R4: posting either visibility never changes request/estimate
  status, response history, estimate terms, revision, or status-history rows.
- AC14 maps to R4: later P003 revision submission retains all earlier comments
  and original visibility while preserving existing supersession behavior.
- AC15 maps to R5: both routes use strict path/query/body validation, standard
  envelopes/correlation, and the documented pagination contract.
- AC16 maps to R5: comment bodies and internal content are absent from
  application logs and safe error output.
- AC17 maps to R6: internal users can deliberately switch visibility and post,
  with every reset returning to the safe `INTERNAL_ONLY` default.
- AC18 maps to R6: client roles can post/read shared comments and receive no
  internal selector, marker, count, artifact, or control.
- AC19 maps to R6: loading, empty, success, validation, permission, network,
  pagination, and server-error states remain keyboard-accessible and usable at
  a narrow viewport.
- AC20 maps to R6: `NEEDS_CLARIFICATION` guidance connects the immutable reason
  to discussion without presenting comment-based resolution or revision.
- AC21 maps to R7: the additive migration preserves prior rows and enforces body
  validity plus stable ordering indexes with no Drizzle drift.
- AC22 maps to R7: seed is twice-idempotent and supplies deterministic
  visibility, clarification, suspended-author, and cross-tenant fixtures.
- AC23 maps to R8: shared, database, API, component, and browser tests cover
  validation, capability, redaction/oracle resistance, ordering, clarification
  continuity, and P001/P002/P003 regressions.
- AC24 maps to R8: contracts, exact SHAs, validation evidence, candidate
  handoff, and prohibited-scope searches are complete.

## Approved Binding Decisions

The human approved these twelve binding decisions on 2026-07-27.

1. **Conversation model:** P004 uses one flat request-level conversation ordered
   oldest-first, not nested threads.
2. **Append-only API:** P004 comments cannot be edited, deleted, restored,
   reacted to, pinned, or moderated through the application.
3. **Shared participation:** every active client-tenant role can read and create
   client-visible comments.
4. **Internal participation:** only `OWNER`, `ADMIN`, and `DEVELOPER` can read
   and create internal-only comments.
5. **Internal safety default:** the internal composer defaults to
   `INTERNAL_ONLY`; sharing requires a deliberate visibility choice.
6. **Body contract:** trimmed body length is 1 through 5,000 characters.
7. **Clarification ownership:** P003 owns the clarification decision, reason,
   lifecycle, and revision; P004 comments only document follow-up discussion.
8. **No comment-driven status:** posting never changes request/estimate state or
   status history.
9. **Lifecycle availability:** comments remain creatable on any request inside
   the active authorized tenant/project boundary, independent of request status.
10. **Past authorship:** comments remain visible after author membership
    suspension according to the current viewer's authorization.
11. **Visibility oracle:** filtering occurs before pagination/counting and
    clients receive no evidence that internal comments exist.
12. **Notification boundary:** the append-only comment record is the durable
    notification-ready source; P007 owns outbox, preferences, delivery, and
    provider integration.

## Suggested Approach

Non-binding implementation direction:

- add a focused `comments` API module rather than expanding change-request or
  estimate repositories;
- extend the centralized capability policy instead of introducing route-local
  role checks;
- query comments through request/project/organization/membership joins and
  apply the visibility predicate in SQL before pagination;
- join authors only for a safe display name and do not require the historical
  author's membership to remain active;
- reuse strict shared Zod schemas, standard envelopes, TanStack Query, React
  Hook Form, CSS Modules, and existing request-detail composition;
- use an explicit list meta DTO to drive presentation while keeping
  authorization in the API;
- preserve the separate P003 estimate response UI and add clarification
  guidance around the request conversation instead of duplicating its reason.

Codex must inspect the approved base and may choose a simpler implementation
that satisfies every binding requirement and criterion.

## Invariants

- Active user, active client organization, active project, and active
  client-organization membership are required for every comment operation.
- Internal AppSolo membership alone never grants client access.
- Services own capabilities; repositories execute tenant- and
  visibility-scoped queries.
- Frontend control hiding is never authorization or redaction evidence.
- Internal-only content and its existence never reach client roles.
- Comment bodies never enter application logs or unsafe error output.
- Existing comment rows are preserved and no hard-delete API is introduced.
- Comments never mutate request/estimate state or P003 response history.
- P001, P002, and P003 behavior and tenant denial remain intact.
- Development and test databases remain separate.
- Migrations are additive and non-destructive by default.
- Strict TypeScript remains enabled; avoid `any`.
- No AWS or external service is required.

## Non-Goals

- NG1: Real-time chat, WebSockets, server-sent events, presence, typing
  indicators, or live subscriptions.
- NG2: Nested threads, replies, mentions, reactions, pins, rich text, Markdown
  rendering, moderation, search, export, or read receipts.
- NG3: Comment edit, delete, restore, visibility change, or hard-delete APIs.
- NG4: New clarification decisions, alternate approvers, comment-driven
  resolution, estimate response changes, or reopening P003 lifecycle rules.
- NG5: Arbitrary request-status mutation, time tracking, assignment, execution,
  review, release notes, or completion behavior from P005.
- NG6: Attachment upload/download behavior or comment attachments from P006.
- NG7: Notification preferences, event outbox, email, templates, SES, digests,
  or delivery behavior from P007.
- NG8: Cognito, passwords, JWTs, production sessions, or account recovery from
  P008.
- NG9: AWS resources/SDKs, deployment, infrastructure, CI/CD, queues, webhooks,
  or background jobs.
- NG10: Payments, invoicing, taxes, discounts, deposits, refunds, accounting,
  or changes to exact estimate pricing.
- NG11: Comments on organizations, projects, estimates, invitations, access
  events, or other objects; P004 comments belong only to change requests.
- NG12: Global administrator bypass, project membership, PostgreSQL row-level
  security, destructive migration rewrites, or production hardening.

## Likely Affected Areas

- `packages/shared`: comment visibility/input/DTO/meta schemas and capabilities.
- `packages/database`: comment checks/indexes, additive migration/snapshot,
  deterministic seed, database tests.
- `apps/api`: comment routes/service/repository, policy, app composition,
  integration tests.
- `apps/web`: API client, request conversation feed/composer/styles, component
  tests.
- `e2e`: internal/client comment flows, redaction, clarification continuity,
  and P001/P002/P003 regressions.
- `markdown/`, `README.md`, `notes/P004/`: contracts and phase evidence.

## Data And Migration Impact

- Schema change: additive comment body check and stable ordering indexes; no
  enum or ownership change is expected.
- Backward compatibility: preserve all existing rows, routes, P003 statuses,
  estimate responses, and seed identifiers.
- Rollback/recovery: checked-in forward migration; no destructive automatic
  rollback or reset.
- Seed/test data: extend deterministic comment visibility, order,
  clarification, author-lifecycle, and other-tenant scenarios.

## Dependencies And Environment

- New dependencies: none proposed.
- Runtime/tooling: preserve the current Node, pnpm, PostgreSQL, Drizzle, React,
  Express, Vitest, and Playwright stack.
- Configuration: no new environment variable is proposed.
- External services: none; tests remain local and offline.

## Automated Validation

- V1: `node scripts/check-scaffolding.mjs` passes.
- V2: `pnpm install` completes with the intended lockfile state.
- V3: `pnpm docker:up` reaches healthy local PostgreSQL.
- V4: `pnpm db:migrate` applies the additive P004 migration to existing P003
  development data without deleting or rewriting rows.
- V5: `pnpm db:seed` passes twice without duplicate comments or related
  fixtures.
- V6: `pnpm --filter @appsolo/database test:prepare` resets only
  `appsolo_client_hub_test` and reapplies migration/seed.
- V7: `pnpm --filter @appsolo/database generate` reports no schema drift after
  the checked-in migration/snapshot.
- V8: `pnpm lint` passes ESLint and Prettier.
- V9: `pnpm typecheck` passes strict checks in every workspace package.
- V10: `pnpm test` passes comment schema, capability, ordering, and database
  constraint tests.
- V11: `pnpm test:api` passes comment validation, role matrix,
  tenant/visibility denial, oracle resistance, ordering/pagination,
  clarification continuity, concurrency, logging, and P001/P002/P003
  regression integration tests against PostgreSQL.
- V12: `pnpm test:web` passes internal/client composers, safe visibility
  default, feed states, redaction, pagination, clarification guidance,
  validation, errors, and accessibility component tests.
- V13: `pnpm build` produces all package and web builds.
- V14: `pnpm test:e2e` passes a real internal-only/shared/client conversation
  and persisted clarification follow-up plus P001/P002/P003 browser regressions
  against the isolated test database.
- V15: direct database/API probes confirm body checks, stable order, client
  filtering before pagination/counting, safe cross-tenant `404`, role `403`,
  no comment-driven status/history change, and persistence after P003 revision.
- V16: a log probe confirms comment bodies, internal content, credentials,
  database URLs, sensitive headers, and full request bodies are absent.
- V17: `node scripts/generate-phase-index.mjs --check` passes.
- V18: `git diff --check <base_sha>..<candidate_sha>` passes.
- V19: repository/manifest searches confirm no P004 non-goal implementation,
  AWS SDK, Cognito, SES, notification delivery, attachment, time-tracking,
  billing, chat transport, or production-session behavior entered the phase.
- V20: `node scripts/validate-phase.mjs P004` passes before review handoff.

Every result must be recorded as `Passed`, `Failed`, or `Not run` with exact
commands and counts or reasons.

## Human QA

- Q1 — Startup/regression: follow the README on the normal development machine;
  confirm Docker/API/web/health and representative P001 request, P002
  sign-in/access/invitation, and P003 estimate/approval behavior still work.
- Q2 — Internal-safe default: as a Northstar `OWNER`, `ADMIN`, or `DEVELOPER`,
  open a request and confirm the fresh composer defaults to internal-only; post,
  refresh, and confirm the labeled comment persists.
- Q3 — Deliberate sharing: as an internal role, deliberately select shared
  visibility, post a comment, refresh, and confirm the shared label, author,
  time, and deterministic position.
- Q4 — Client conversation: as `CLIENT_ADMIN` and `CLIENT_MEMBER`, read and post
  client-visible comments; confirm neither identity sees an internal selector,
  count, placeholder, gap, or internal-content artifact.
- Q5 — Clarification continuity: request estimate clarification as the client
  administrator, discuss it with client-visible comments, submit a P003
  revision as an estimate manager, and confirm the original reason/comments
  persist without a comment changing lifecycle state.
- Q6 — Capability denial: attempt internal-only creation through the direct API
  as both client roles and confirm safe `403`, no insert, and no internal
  existence disclosure.
- Q7 — Tenant/lifecycle denial: confirm other-tenant, internal-only,
  suspended-membership, inactive-scope, and inaccessible-ID requests cannot
  list or create comments while past comments by a now-suspended author remain
  visible to current authorized viewers.
- Q8 — Ordering/concurrency/pagination: create concurrent and enough sequential
  comments to paginate; confirm none are lost or duplicated and each authorized
  view retains stable oldest-first order.
- Q9 — Validation/redaction/failure: exercise empty, whitespace, over-limit,
  unknown-field, permission, network, and server failures; confirm recoverable
  input, safe envelopes, no state changes, and no bodies/internal content in
  logs.
- Q10 — Accessibility/responsive: use keyboard-only navigation and a narrow
  viewport through feed pagination, internal/shared choice, composition,
  validation, success, and error states; confirm labels, focus, announcements,
  wrapping, and clarification guidance remain usable.

## Deliverables

- Shared comment schemas, DTOs, metadata, and centralized capabilities.
- Additive comment integrity/ordering migration and matching snapshot.
- Tenant- and visibility-scoped comment API.
- Ordered role-aware request conversation and clarification guidance.
- Meaningful unit, database, API, component, and Playwright coverage.
- Updated durable contracts, README, phase evidence, candidate commit, and
  implementation handoff.

## Open Human Decisions

No additional material product, security, data, architecture, external-service,
or cost decision is known at approved specification version 1.
