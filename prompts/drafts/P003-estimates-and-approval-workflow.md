---
phase: P003
spec_version: 1
status: draft
approved_by: null
approved_date: null
drafted_date: 2026-07-26
last_verified_sha: 745892af6c9393838e490f12ddaa3536a9524f88
---

# P003 — Estimates And Approval Workflow

> This is a non-authorizing draft. Implementation must not begin until the
> human approves a consolidated revision, the prompt is moved to
> `prompts/active/`, and the canonical P003 phase record becomes `approved`.

## Problem

P001 and P002 provide a locally integrated, tenant-safe request and access
foundation, but a submitted change request still has no operational estimate or
client-decision workflow. The database contains an intentionally unused
`estimates` table and broad future status enums, while the API and browser expose
none of that behavior.

The current placeholder is insufficient because:

- estimate hours, rate, cost, version, and submission rules are not external
  contracts;
- no capability distinguishes estimate preparation from client approval;
- the server does not calculate cost or define a rounding policy;
- draft estimates have no edit/submit lifecycle or optimistic state check;
- client roles cannot approve, reject, or request clarification;
- submitted estimate terms and client responses have no immutable shared
  decision record;
- change-request and estimate status transitions are not coordinated in one
  transaction;
- the request detail page does not show estimates, decisions, or role-aware
  actions.

P003 must close those gaps without entering comments, work execution, billing,
notifications, production authentication, attachments, or AWS.

## Outcome

On the fully local stack:

1. authorized AppSolo service roles can create and edit one exact-decimal draft
   estimate for an authorized change request;
2. submitting a draft freezes that version's terms, makes it visible to client
   roles, and atomically moves the request to `AWAITING_APPROVAL`;
3. an authorized client administrator can approve, reject, or request
   clarification exactly once for the current submitted version;
4. the decision atomically updates estimate/request state and writes durable
   response and request-status history;
5. rejected or clarification-requested work can receive a later numbered
   revision without overwriting the prior terms or response;
6. every estimate DTO uses normalized decimal strings and the server derives
   cost using explicit decimal-safe rounding;
7. draft visibility, decision controls, and every API mutation obey centralized
   capabilities and tenant scope;
8. all P001 change-request and P002 session/access behavior remains intact.

## Current Repository Evidence

- Draft basis: authoritative local `main` at
  `745892af6c9393838e490f12ddaa3536a9524f88`.
- P001 and P002 are complete, reviewed, human-QA passed, and locally integrated.
- `estimates` already stores `estimated_hours numeric(8,2)`,
  `hourly_rate numeric(12,2)`, `estimated_cost numeric(12,2)`, scope notes, and
  the existing `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `SUPERSEDED`
  status enum.
- The estimate placeholder has no version, submitted timestamp, response table,
  API module, shared DTO, or browser workflow.
- The seed contains one `DRAFT` estimate for a Northstar request in
  `AWAITING_ESTIMATE`; its exact strings are `4.50`, `125.00`, and `562.50`.
- `status_history` already records immutable change-request transitions.
- Change-request statuses already include `AWAITING_ESTIMATE`,
  `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`, and
  `NEEDS_CLARIFICATION`.
- P002 centralizes membership capabilities, but currently grants only request
  and access-administration capabilities.
- Active client-organization membership remains the tenant root. Internal
  AppSolo membership alone grants no client access.
- The change-request detail UI currently renders only request fields.
- ADR-0004 requires PostgreSQL numeric values, decimal strings at TypeScript/JSON
  boundaries, and decimal-safe arithmetic.
- No decimal arithmetic library is currently installed.

Codex must revalidate every claim and record the exact implementation base SHA
after human approval.

## Requirements

### R1 — Extend Centralized Capabilities Without Weakening Tenant Scope

- Add typed `VIEW_ESTIMATES`, `MANAGE_ESTIMATES`, and
  `RESPOND_TO_ESTIMATES` capabilities to the existing centralized policy.
- Every active role in an active client organization may view client-visible
  submitted/historical estimates.
- `OWNER`, `ADMIN`, and `DEVELOPER` may create, edit, and submit estimates for a
  client organization where they hold that active role.
- `CLIENT_ADMIN` may respond to the current submitted estimate.
- `CLIENT_MEMBER` may view client-visible estimate history but may not create,
  edit, submit, or respond.
- `OWNER`, `ADMIN`, and `DEVELOPER` may not act as the client approver merely
  because they can manage estimates.
- An AppSolo internal-organization membership grants no implicit client-project
  access; the active membership in the request's client organization remains
  mandatory.
- Every estimate read and mutation rechecks active user, organization, project,
  membership, capability, request, and estimate scope in the API
  service/repository path.

### R2 — Define Exact Decimal Inputs, Calculation, And Output

- External estimated-hours and hourly-rate values are decimal strings, never
  JavaScript numbers.
- Accept at most two fractional digits, normalize successful values to exactly
  two digits, and reject exponent notation, signs, commas, whitespace-only
  values, `NaN`, and `Infinity`.
- Estimated hours must be greater than `0.00` and fit `numeric(8,2)`.
- Hourly rate must be at least `0.00` and fit `numeric(12,2)`.
- The client never supplies `estimatedCost`.
- The service calculates `estimatedCost = estimatedHours × hourlyRate` with
  decimal-safe arithmetic and round-half-up to two currency digits.
- Reject input when the calculated result cannot fit `numeric(12,2)`.
- Persist and return normalized two-decimal strings for hours, rate, and cost.
- JavaScript floating-point arithmetic must not determine validation,
  calculation, rounding, persistence, or equality.
- The database adds a matching invariant that stored cost equals the
  two-decimal rounded product of stored hours and rate.

### R3 — Add One Optimistic, Versioned Draft Per Request

- An authorized estimate manager can create a draft with estimated hours,
  hourly rate, and trimmed scope notes.
- Scope notes are required, client-visible after submission, and constrained to
  10 through 10,000 characters.
- The server assigns a positive, monotonically increasing version number within
  the change request.
- At most one `DRAFT` estimate may exist per change request, including under
  concurrent creation.
- Draft creation is allowed only while the request is `SUBMITTED`,
  `AWAITING_ESTIMATE`, `REJECTED`, or `NEEDS_CLARIFICATION`.
- Creating the first draft for a `SUBMITTED` request atomically moves that
  request to `AWAITING_ESTIMATE` and writes one status-history row. Other
  allowed request states remain unchanged until submission.
- Only a draft may be edited. Edit accepts the complete mutable terms plus
  `expectedUpdatedAt`, recalculates cost, and rejects stale state with `409`.
- A draft is visible only to `MANAGE_ESTIMATES` roles. It is never serialized
  to client roles or exposed through a tenant oracle.
- Estimate rows have no hard-delete API.

### R4 — Submit Immutable Estimate Terms Transactionally

- Submission accepts `expectedUpdatedAt` and is allowed only for the current
  draft when the request is not already awaiting a response or approved.
- One tenant-scoped transaction locks the request and relevant estimate rows,
  rechecks authorization/state, marks the draft `SUBMITTED`, records
  `submittedAt`, moves the request to `AWAITING_APPROVAL`, and inserts one
  request status-history row.
- Hours, rate, cost, scope notes, version, request, and creator become immutable
  after submission.
- When submitting a later revision, the immediately preceding `REJECTED` or
  `NEEDS_CLARIFICATION` estimate becomes `SUPERSEDED`; its original terms and
  immutable response remain available in history.
- A submitted estimate cannot be withdrawn, edited, replaced, or superseded
  while it awaits a client response.
- An approved estimate cannot be revised or superseded in P003.
- Concurrent or repeated submission produces at most one success and one
  request status-history transition.

### R5 — Record One Durable Client Response

- `RESPOND_TO_ESTIMATES` applies only to the current `SUBMITTED` estimate while
  its request is `AWAITING_APPROVAL`.
- A strict response command supports `APPROVE`, `REJECT`, and
  `REQUEST_CLARIFICATION`.
- Approval may include an optional trimmed note of at most 2,000 characters.
- Rejection and clarification require a trimmed reason from 3 through 2,000
  characters.
- One transaction locks the estimate/request, verifies
  `expectedUpdatedAt`, inserts one immutable response, updates the estimate
  status, updates the request status, and inserts one request status-history
  row:
  - `APPROVE` -> estimate `APPROVED`, request `APPROVED`;
  - `REJECT` -> estimate `REJECTED`, request `REJECTED`;
  - `REQUEST_CLARIFICATION` -> estimate `NEEDS_CLARIFICATION`, request
    `NEEDS_CLARIFICATION`.
- The response records estimate, decision, actor, note, and timestamp. It has no
  update or delete API.
- A unique constraint and conditional state update enforce at most one response
  per estimate under concurrent calls.
- Duplicate, stale, or no-longer-actionable responses return `409` without
  changing durable state.
- Approval does not start work or enter `IN_PROGRESS`; execution transitions
  remain P005.

### R6 — Expose Explicit Estimate And Decision History

- Add explicit estimate and response DTOs; never serialize raw database rows.
- Internal estimate managers receive the current draft plus all submitted and
  historical versions.
- Client roles receive only submitted or historical client-visible versions,
  never draft existence or draft terms.
- Estimate history is ordered by version descending, then ID for stability.
- Each visible version includes exact terms, creator display name, status,
  submission time, timestamps, and its response when one exists.
- Response DTOs include only decision, safe shared note, actor display name, and
  timestamp.
- Prior versions and responses remain readable after supersession.
- Missing and inaccessible request/estimate identifiers return the same
  `404 NOT_FOUND` behavior on identifier routes.
- No estimate or response output contains internal membership data, raw numeric
  driver values, arbitrary metadata, or unrelated tenant data.

### R7 — Add Strict Versioned API Contracts

Implement and document:

- `GET /api/v1/change-requests/:changeRequestId/estimates`;
- `POST /api/v1/change-requests/:changeRequestId/estimates`;
- `PATCH /api/v1/estimates/:estimateId`;
- `POST /api/v1/estimates/:estimateId/submit`;
- `POST /api/v1/estimates/:estimateId/respond`.

Contract rules:

- preserve `/api/v1`, standard success/error envelopes, and request IDs;
- validate every path, query, and body with strict shared Zod schemas;
- reject unknown fields and reject client-supplied cost/status/version/actor
  fields;
- use `403 FORBIDDEN` for an authorized tenant collection whose actor lacks the
  required capability;
- use `404 NOT_FOUND` for inaccessible request/estimate identifiers when
  existence disclosure would create an oracle;
- use `409 CONFLICT` for duplicate draft, stale state, repeated response, or
  invalid lifecycle state;
- keep validation errors safe and field-specific;
- do not log estimate scope notes, response notes, monetary bodies, credentials,
  database values, or full request bodies.

### R8 — Deliver A Role-Aware Estimate And Approval UI

- Extend change-request detail with an estimate section and version history.
- Estimate managers can create/edit the current draft, see server-derived cost,
  submit it, and receive validation, stale-state, success, and failure feedback.
- Cost is read-only and recalculated from validated hours/rate rather than
  accepted as an editable field.
- Client roles never see draft cards, draft loading artifacts, or management
  controls.
- A client administrator sees approve, reject, and request-clarification actions
  only for the current actionable submitted version.
- Rejection and clarification interfaces require the shared reason validation;
  approval supports an optional note.
- Client members can view submitted/history terms but see no response controls.
- Historical versions clearly distinguish submitted, approved, rejected,
  clarification-requested, and superseded states.
- Successful mutations invalidate/refetch request, estimate, and session-relevant
  query state without leaking one identity's cache to another.
- Preserve accessible labels, keyboard operation, focus/announcement behavior,
  loading/empty/error/success states, exact currency formatting, and
  narrow-viewport usability.

### R9 — Apply Additive Data And Seed Changes

- Use additive checked-in Drizzle migrations and matching snapshots.
- Add `NEEDS_CLARIFICATION` to the estimate status enum.
- Add positive estimate `version` and nullable `submittedAt`, backfilling the
  existing seeded estimate as version 1.
- Add uniqueness for `(change_request_id, version)` and a partial unique
  constraint for one draft per change request.
- Add a partial unique constraint for at most one currently `SUBMITTED`
  estimate per change request as a lifecycle backstop.
- Add the stored-cost arithmetic invariant described in R2.
- Add an immutable estimate-response table with an
  `APPROVED`/`REJECTED`/`CLARIFICATION_REQUESTED` decision enum, estimate,
  responding user, optional note, and timestamp; enforce one response per
  estimate.
- Use restrictive foreign keys and add tenant/history access indexes.
- Keep every existing P001/P002 row and migration valid; do not reset or rewrite
  existing migrations.
- Extend deterministic fake seed data with actionable submitted, approved,
  rejected, clarification, superseded, and cross-tenant scenarios.
- Keep seed idempotence, guarded local reset behavior, and strict development/test
  database separation.

### R10 — Preserve Regression, Documentation, And Review Evidence

- Preserve every P001 request list/detail/create and tenant-denial contract.
- Preserve every P002 sign-in/session/invitation/membership/audit contract,
  including cache isolation and active-membership enforcement.
- Add meaningful shared/database unit, PostgreSQL API integration, React
  component, and real Playwright browser coverage.
- Update API, data, security, testing, architecture, README, and accepted ADR
  documentation where approved behavior changes.
- Record exact validation results as `Passed`, `Failed`, or `Not run`.
- Create an immutable candidate commit and
  `notes/P003/implementation-handoff.md`.
- Advance P003 only through the normal review lifecycle; Codex must not mark it
  complete.

## Acceptance Criteria

- AC1 maps to R1: session/member capabilities expose the exact estimate matrix,
  while every estimate API independently enforces it.
- AC2 maps to R1: internal-only membership, another tenant, suspended
  membership, developer/client-member response attempts, and client
  create/edit/submit attempts are denied without data leakage.
- AC3 maps to R2: hours/rate/cost use normalized two-decimal strings and no
  external contract accepts cost as input.
- AC4 maps to R2: decimal-safe multiplication and round-half-up produce exact
  boundary results, reject overflow, and satisfy the database cost invariant.
- AC5 maps to R3: authorized creation produces one numbered draft and, when
  applicable, one atomic `SUBMITTED -> AWAITING_ESTIMATE` request transition.
- AC6 maps to R3: concurrent duplicate drafts cannot exist; stale edits return
  `409` and preserve the newer terms.
- AC7 maps to R3/R6: draft existence and terms are visible to estimate managers
  and absent from every client DTO/UI state.
- AC8 maps to R4: submission freezes terms, records `submittedAt`, moves the
  request to `AWAITING_APPROVAL`, and writes one history row atomically.
- AC9 maps to R4: repeated/concurrent submission has one success; a request
  awaiting response or already approved cannot receive another submitted
  estimate.
- AC10 maps to R4/R6: later valid submission supersedes only the prior rejected
  or clarification-requested version and retains its terms/response in history.
- AC11 maps to R5: client-admin approval atomically creates one immutable
  response and moves estimate/request to `APPROVED`.
- AC12 maps to R5: rejection requires a reason and atomically moves
  estimate/request to `REJECTED`.
- AC13 maps to R5: clarification requires a reason and atomically moves
  estimate/request to `NEEDS_CLARIFICATION`.
- AC14 maps to R5: repeated, stale, or concurrent client responses produce one
  durable outcome and safe `409` failures without extra history.
- AC15 maps to R5: approval never moves a request to `IN_PROGRESS` or another
  P005 execution state.
- AC16 maps to R6: authorized history is version-descending, explicit,
  tenant-scoped, and retains superseded terms plus the original decision.
- AC17 maps to R6/R7: inaccessible request/estimate identifiers do not reveal
  cross-tenant existence or draft state.
- AC18 maps to R7: every route uses strict path/body validation, standard
  envelopes/correlation, and rejects server-owned or unknown write fields.
- AC19 maps to R8: an estimate manager can create, edit, see exact derived cost,
  submit, refresh, and observe persisted history through the browser.
- AC20 maps to R8: a client administrator can approve/reject/request
  clarification through accessible success, validation, conflict, and error
  states.
- AC21 maps to R8: client-member controls are absent, client draft artifacts are
  absent, and narrow/keyboard behavior remains usable.
- AC22 maps to R9: additive migrations preserve P001/P002 data, enforce version,
  draft, response, and arithmetic invariants, and Drizzle reports no drift.
- AC23 maps to R9: seed is twice-idempotent and provides deterministic
  role/lifecycle/tenant fixtures without real credentials or sensitive content.
- AC24 maps to R10: shared, database, API, component, and browser tests cover
  exact arithmetic, visibility, lifecycle, concurrency, tenant denial, and
  P001/P002 regressions.
- AC25 maps to R10: contracts, exact SHAs, validation evidence, candidate
  handoff, and prohibited-scope searches are complete.

## Proposed Binding Decisions

These become binding only if the human approves this prompt revision.

1. **Currency:** P003 uses one implicit business currency, USD, and does not add
   currency selection or conversion.
2. **Rounding:** cost is hours multiplied by rate and rounded half-up to two
   decimal places.
3. **Estimate managers:** `OWNER`, `ADMIN`, and `DEVELOPER` manage estimates in
   client organizations where they have an active membership.
4. **Client decision role:** only `CLIENT_ADMIN` responds; `CLIENT_MEMBER` can
   view submitted/history terms but cannot decide.
5. **Draft visibility:** drafts are visible only to estimate managers and are
   completely absent from client responses.
6. **One draft:** each request has at most one draft; the server assigns
   monotonically increasing versions.
7. **Submitted immutability:** submitted terms cannot be edited or withdrawn.
8. **Decision notes:** reject/clarification reasons are required; approval note
   is optional.
9. **Response finality:** one response is allowed per estimate version and is
   immutable.
10. **Revision:** only rejected or clarification-requested estimates may be
    followed by a new draft; the prior version becomes superseded when the new
    version is submitted.
11. **Approved finality:** P003 does not revise or revoke an approved estimate.
12. **Request transitions:** estimate actions own only
    `AWAITING_ESTIMATE`, `AWAITING_APPROVAL`, `APPROVED`, `REJECTED`, and
    `NEEDS_CLARIFICATION`; P005 owns work-execution transitions.
13. **History:** submitted estimate terms, responses, and related request status
    history are retained with no hard-delete API.
14. **Concurrency:** optimistic timestamps plus transaction locks/conditional
    updates protect drafts, submission, and response.

## Suggested Approach

Non-binding implementation direction:

- add a focused `estimates` API module rather than expanding access
  administration;
- extend the centralized capability policy instead of introducing route-local
  role checks;
- use a small reviewed arbitrary-precision decimal library or a carefully tested
  fixed-scale integer implementation; never calculate through `number`;
- keep decimal parsing/normalization helpers in a narrow shared or domain-safe
  boundary with exhaustive unit tests;
- use a transaction and row locks for version allocation, submit, supersession,
  response, request status, and status history;
- model client responses as immutable rows rather than mutable note fields on an
  estimate;
- compose explicit DTO queries through request/project/organization scope;
- extend the existing detail page and TanStack Query client rather than adding a
  general state framework;
- use shared Zod schemas with React Hook Form for estimate and response forms.

Codex must inspect the approved base and may choose a simpler implementation
that satisfies every binding requirement and criterion.

## Invariants

- Active user, active organization, active project, and active client-organization
  membership are required for every estimate operation.
- Internal AppSolo membership alone never grants client access.
- Services own capabilities and lifecycle transitions; repositories execute
  tenant-scoped queries.
- Hidden controls and client-side calculations are never authorization or
  financial-integrity evidence.
- Draft estimate existence and terms never reach client roles.
- Submitted terms and client responses are durable and are not overwritten.
- Money and hours remain exact decimal strings outside PostgreSQL.
- JavaScript floating point never determines stored monetary values.
- Request and estimate state plus history change atomically.
- P001 and P002 behavior and tenant denial remain intact.
- Development and test databases remain separate.
- Migrations are additive and non-destructive by default.
- Strict TypeScript remains enabled; avoid `any`.
- No AWS or external service is required.

## Non-Goals

- NG1: Payments, invoicing, billing, tax, discounts, deposits, refunds, or
  accounting integration.
- NG2: Multiple currencies, currency selection, exchange rates, or localization
  beyond clear USD formatting.
- NG3: Estimate line items, templates, rate cards, discounts, or project-wide
  pricing configuration.
- NG4: Partial, conditional, delegated, scheduled, or multi-party approval.
- NG5: Editing, withdrawing, deleting, or revoking submitted/approved estimates.
- NG6: Arbitrary manual change-request status mutation.
- NG7: Starting work, time tracking, assignment, release notes, review, or
  completion behavior from P005.
- NG8: General comments, threaded clarification conversation, or internal notes
  from P004; P003 includes only the typed shared response note.
- NG9: Attachment upload/download behavior from P006.
- NG10: Email, notification events/outbox, preferences, templates, or SES from
  P007.
- NG11: Cognito, JWTs, passwords, production sessions, account recovery, or
  other P008 authentication.
- NG12: AWS SDKs/resources, deployment, CI/CD, or production infrastructure.
- NG13: Background jobs, queues, webhooks, real-time updates, or analytics.
- NG14: Hard-delete estimate/response APIs or destructive migration rewrites.

## Likely Affected Areas

- `packages/shared`: decimal schemas, estimate/response DTOs, capabilities.
- `packages/database`: enum/table changes, migration/snapshot, seed, invariant
  tests.
- `apps/api`: estimate routes/service/repository, capability policy, app
  composition, integration tests.
- `apps/web`: API client, change-request detail estimate/history/forms,
  component tests and styles.
- `e2e`: internal draft/submit, client response, visibility, and P001/P002
  regression flows.
- `markdown/`, `README.md`, `notes/P003/`: approved contracts and evidence.

## Data And Migration Impact

- Schema change: additive estimate status, version/submission fields,
  uniqueness/arithmetic constraints, and immutable estimate responses.
- Backward compatibility: backfill the existing seeded estimate as version 1;
  preserve all P001/P002 data and APIs.
- Rollback/recovery: checked-in forward migration; no destructive automatic
  rollback or reset.
- Seed/test data: add deterministic estimate versions and response states across
  authorized and other-tenant fixtures.

## Dependencies And Environment

- New dependency: a small decimal library may be added only if the approved
  implementation chooses it and the manifest/lockfile change is reviewed.
- Runtime/tooling: preserve the current Node, pnpm, PostgreSQL, Drizzle, React,
  Express, Vitest, and Playwright stack.
- Configuration: no new environment variable is proposed.
- External services: none; tests remain local and offline.

## Automated Validation

- V1: `node scripts/check-scaffolding.mjs` passes.
- V2: `pnpm install` completes with the intended lockfile state.
- V3: `pnpm docker:up` reaches healthy local PostgreSQL.
- V4: `pnpm db:migrate` applies the additive P003 migration to existing P002
  development data.
- V5: `pnpm db:seed` passes twice without duplicate estimates, responses, or
  history.
- V6: `pnpm --filter @appsolo/database test:prepare` resets only
  `appsolo_client_hub_test` and reapplies migration/seed.
- V7: `pnpm --filter @appsolo/database generate` reports no schema drift after
  checked-in migration/snapshot.
- V8: `pnpm lint` passes ESLint and Prettier.
- V9: `pnpm typecheck` passes strict checks in every workspace package.
- V10: `pnpm test` passes decimal parsing/calculation and database invariant
  tests.
- V11: `pnpm test:api` passes estimate lifecycle, exact arithmetic, capability,
  tenant-denial, draft-visibility, revision, concurrency, history, and P001/P002
  regression integration tests against PostgreSQL.
- V12: `pnpm test:web` passes internal estimate forms, exact derived display,
  client decisions, role hiding, history, validation, conflict, and
  accessibility component tests.
- V13: `pnpm build` produces all package and web builds.
- V14: `pnpm test:e2e` passes a real internal draft/submit -> client decision ->
  persisted history flow plus P001/P002 browser regressions against the isolated
  test database.
- V15: direct API probes confirm exact decimal strings, client draft absence,
  safe cross-tenant denial, stale conflict, and one-response behavior.
- V16: a log probe confirms scope notes, response notes, monetary request bodies,
  credentials, database URLs, and sensitive headers are absent.
- V17: `node scripts/generate-phase-index.mjs --check` passes.
- V18: `git diff --check <base_sha>..<candidate_sha>` passes.
- V19: repository/manifest searches confirm no P003 non-goal implementation,
  AWS SDK, Cognito, SES, payment, comment, time-tracking, or production-session
  behavior entered the phase.
- V20: `node scripts/validate-phase.mjs P003` passes before review handoff.

Every result must be recorded as `Passed`, `Failed`, or `Not run` with exact
commands and counts or reasons.

## Human QA

- Q1 — Startup/regression: follow the README on the normal development machine;
  confirm Docker/API/web/health and representative P001 request plus P002
  sign-in/access/invitation behavior still work.
- Q2 — Exact draft: as a Northstar estimate manager, create a draft using
  decimal boundary values and confirm normalized hours/rate plus server-derived
  rounded USD cost persist after refresh.
- Q3 — Draft edit/concurrency: edit the draft, confirm cost recalculation, and
  prove a stale second-browser edit fails without overwriting newer terms.
- Q4 — Submission/visibility: submit the draft, confirm terms become immutable,
  request state becomes awaiting approval, client roles can now see the version,
  and no client ever saw the draft.
- Q5 — Approval: as a client administrator approve with an optional note;
  confirm one response, approved request/estimate state, retained terms/history,
  and no automatic in-progress transition.
- Q6 — Rejection/revision: reject with a required reason, create and submit a
  later version, and confirm the prior terms/response remain visible as
  superseded history.
- Q7 — Clarification/revision: request clarification with a required reason,
  confirm the specific state, then submit a revised estimate without entering
  the general P004 comment workflow.
- Q8 — Capability/tenant denial: confirm owner/admin/developer management,
  client-admin response, client-member read-only behavior, absent controls, and
  direct API denial for wrong-role, suspended, internal-only, and other-tenant
  users.
- Q9 — History/concurrency/redaction: attempt concurrent responses and prove one
  durable outcome/history transition; inspect API/UI/log evidence for tenant
  isolation, exact strings, and sensitive-body redaction.
- Q10 — Accessibility/responsive: use keyboard-only navigation and a narrow
  viewport through estimate create/edit/submit, decision-note validation,
  approval/reject/clarification, history, conflict, success, and failure states.

## Deliverables

- Exact decimal schemas/calculation and expanded capability contracts.
- Additive estimate revision/response migration and matching snapshot.
- Tenant-scoped estimate lifecycle API and immutable response history.
- Role-aware estimate and client-decision browser experience.
- Meaningful unit, database, API, component, and Playwright coverage.
- Updated durable contracts, README, phase evidence, candidate commit, and
  implementation handoff.

## Open Human Decisions

Human review must approve or revise:

1. implicit USD and round-half-up exact-cost policy;
2. `OWNER`/`ADMIN`/`DEVELOPER` estimate management and `CLIENT_ADMIN`-only
   response capability;
3. complete draft invisibility for client roles;
4. one-draft, numbered-version, immutable-submission model;
5. required reject/clarification reasons and optional approval note;
6. no withdrawal/replacement while awaiting response and no approved-estimate
   revision;
7. superseding the prior rejected/clarification version only when the next
   version is submitted;
8. immutable one-response-per-version history and the exact request transition
   mapping.
