# Testing And Validation Contract

## Principles

- Tests prove user-visible behavior, authorization, data integrity, and stable contracts.
- A command that exits successfully without running a real checker is not a pass.
- Static checks do not replace integration or browser testing.
- Development and test databases must be separate.
- Tests must not call AWS or depend on internet access.
- Every validation result is recorded as `Passed`, `Failed`, or `Not run`.

## Required Root Commands After P001

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:api
pnpm test:web
pnpm test:e2e
pnpm build
pnpm db:migrate
pnpm db:seed
pnpm docker:up
pnpm docker:down
```

P001 may add targeted commands, but these names should remain the normal operator interface unless the human approves a change.

## Test Layers

### Shared Unit Tests

Use Vitest to verify:

- change-request input parsing;
- enum acceptance and rejection;
- requested completion date format;
- environment schemas where they are package-safe;
- API response helper behavior where useful.

Avoid tests that only repeat TypeScript types.

### API Integration Tests

Use Vitest and Supertest against the assembled Express app and the isolated PostgreSQL test database.

Required P001 cases:

- health endpoint succeeds when the database is available;
- health endpoint reports unavailability safely when the database check fails;
- invalid environment configuration fails fast;
- authorized user creates a change request;
- creation persists the change request and initial status history in one transaction;
- unauthorized user cannot list, view, or create under another tenant;
- authorized list returns only the requested project and deterministic ordering;
- detail route returns the correct authorized record;
- validation errors use the stable error envelope.

Test setup may migrate and truncate the test database, but it must never reset the development database.

### Frontend Component Tests

Use Vitest, React Testing Library, and user-event.

Required P001 case:

- a user completes the creation form, sees validation for invalid input, submits valid input, and observes success behavior through the public UI.

Tests should query by accessible role and label when practical.

### Browser Smoke Test

Use Playwright against the real local web and API processes with the test database.

Required P001 smoke:

1. open the seeded project change-request page;
2. confirm the seeded list renders;
3. create a valid request;
4. confirm navigation or detail display shows the saved values;
5. refresh and confirm persistence.

A second tenant-denial case may use direct API setup if switching development users through the UI is not part of P001.

### P002 Coverage

Shared tests cover normalized strict sign-in/invitation inputs, high-entropy-sized acceptance tokens, and optimistic membership updates.

API integration tests must cover:

- normalized active sign-in and safe invited/suspended/unknown denial;
- explicit sessions/capabilities and active-membership filtering;
- owner/admin/client-admin role ceilings, internal-role restrictions, and cross-tenant denial;
- token hashing, seven-day expiry, duplicate pending concurrency, resend rotation, revoke, and generic invalid behavior;
- atomic single-use acceptance under concurrency;
- membership suspend/reactivate, stale state, self-suspension, and last-owner protection;
- tenant-scoped newest-first audit output and token/hash/body redaction;
- all P001 authorization and change-request regressions.

Component tests cover sign-in, fragment scrubbing, acceptance states, role-aware control hiding, invitation link feedback, and membership actions. Playwright covers the real copy-link/accept/session/capability flow plus the P001 list/create/refresh regression.

### P003 Coverage

Shared tests cover decimal syntax, normalization, limits, exact multiplication,
round-half-up boundaries, overflow, and response-note commands. Database tests
prove the stored-cost and non-null rejection/clarification-reason constraints.
PostgreSQL API integration tests cover the
capability matrix, draft invisibility, tenant denial, optimistic edits,
single-draft and single-response concurrency, immutable submission, all
decisions, revision/supersession, strict bodies, and P001/P002 regressions.
Component tests cover exact draft preview/create, client read-only history,
client-admin reason validation/actions, and stale feedback. Playwright covers a
real manager draft/edit/submit to client-admin approval flow with persisted
history.

### P004 Coverage

Shared and database tests cover strict trimmed bodies, visibility, pagination
defaults, unsupported null characters, unknown/server-owned fields, and the
PostgreSQL body check. API integration tests cover the exact role matrix, active
tenant lifecycle, internal filtering before pagination, safe `403`/`404`
behavior, explicit DTOs, deterministic equal-time ordering, concurrent
creation, suspended authorship, no P003 lifecycle mutation, and a forced
database-error log capture that proves bodies/query parameters are absent.
Component tests cover internal-safe reset, client-only composition,
validation/server recovery, labels, clarification guidance, exact-page
lookahead, and relocation to a newly created comment on paginated feeds.
Playwright covers persisted internal and shared clarification discussion
against the isolated test database.

### P005 Coverage

Shared tests cover strict time/work/review/cancellation bodies, real calendar
dates, text safety, pagination, and the centralized capability surface.
Database tests cover duration/description/void invariants, request-local
handoff uniqueness, and one response per handoff. PostgreSQL API integration
tests cover the exact role matrix; active tenant lifecycle; private-time
redaction, totals, durable/concurrent voids; exact status transitions and
atomic history; concurrent handoffs/responses; repeated review and completion;
cancellation and estimate freezing; deterministic equal-time history with
filtering before pagination; historical suspended authorship; strict errors;
and forced-failure log redaction. Component tests cover role-aware work, time,
review, cancellation, history, recoverable validation/server failures, and
client absence of private-time artifacts. Playwright covers the complete
approved-to-completed lifecycle with private time, requested changes, a second
handoff, client acceptance, and P001–P004 browser regressions.

## Database Test Isolation

Docker Compose should initialize:

- `appsolo_client_hub_dev`
- `appsolo_client_hub_test`

The API uses `DATABASE_URL`. Integration and E2E test processes use `TEST_DATABASE_URL` or an explicitly injected test URL.

No test may infer the test database by string replacement on an arbitrary production URL.

## P001 Validation Sequence

Codex should run and record, at minimum:

```bash
node scripts/check-scaffolding.mjs
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm test:api
pnpm test:web
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
node scripts/generate-phase-index.mjs --check
git diff --check <base_sha>..<candidate_sha>
```

Codex should also perform a direct health request and a basic frontend-to-API request. Playwright may satisfy the latter when it clearly uses the running API.

Claude should independently rerun the most important commands, especially typecheck, API integration tests, authorization tests, production build, and the browser smoke when the environment supports it.

P002 uses the active prompt's V1-V20 sequence. `pnpm --filter @appsolo/database generate` must report no new migration after the checked-in P002 migration/snapshot, and `node scripts/validate-phase.mjs P002` must pass before handoff.

P004 uses the active prompt's V1-V20 sequence. Drizzle generation must report
no drift after the checked-in P004 migration/snapshot, and
`node scripts/validate-phase.mjs P004` must pass before handoff.

P005 uses the active prompt's V1–V20 sequence. Drizzle generation must report
no drift after the checked-in P005 migration/snapshot. Direct probes must cover
transaction/concurrency, terminal-state, totals, history-oracle, and structured
log redaction claims. `node scripts/validate-phase.mjs P005` must pass before
handoff.

## Validation Evidence

Each phase record must contain:

| ID  | Command       | Result                | Evidence                 |
| --- | ------------- | --------------------- | ------------------------ |
| V1  | exact command | Passed/Failed/Not run | concise output or reason |

Do not record “tests passed” without naming the commands and test counts or relevant result summary.

## Human QA

Human QA must use the Q-IDs from the active prompt and record:

- browser and version;
- operating system;
- application commit/build;
- development user and tenant setup;
- action and expected result;
- actual result;
- screenshots or logs when useful;
- untested conditions.
