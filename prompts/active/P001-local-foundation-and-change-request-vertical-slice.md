---
phase: P001
spec_version: 1
status: approved
approved_by: human
approved_date: 2026-07-25
last_verified_sha: null
---

# P001 — Local Foundation And Change-Request Vertical Slice

## Problem

AppSolo Client Hub currently exists only as a product and architecture definition. There is no local application foundation proving that an authenticated, authorized user can submit and retrieve a client change request through a React frontend, Express API, and PostgreSQL database.

The foundation must establish tenant safety, validation, testing, and durable AI review boundaries before AWS services or broader workflow features are introduced.

## Outcome

A developer can clone or open the repository, start local PostgreSQL, migrate and seed the database, run the web and API applications, and use a development-only simulated identity to list, view, and create change requests for an authorized project.

The saved request persists in PostgreSQL, appears in the React UI after refresh, and cannot be accessed by a user from an unauthorized tenant. The repository passes meaningful lint, type, test, build, migration, seed, and browser-smoke checks. No AWS service is required or configured.

## Pre-Implementation Revalidation

Before editing, Codex must:

1. inspect the current directory and `git status`;
2. determine whether Git is already initialized;
3. record the base branch and exact base SHA;
4. inspect available Node.js, Corepack/pnpm, Docker, and Docker Compose versions;
5. read all mandatory files from `AGENTS.md`;
6. confirm the prompt remains valid against current code;
7. update the P001 phase record with revalidation evidence;
8. create the scoped branch `phase/P001-local-foundation` unless an equivalent approved branch already exists.

If no application code exists, that is expected. Do not ask unnecessary questions. Make normal implementation decisions within the contracts.

## Requirements

### R1 — Workspace And Engineering Tooling

Create a pnpm workspace monorepo with:

- root `package.json` and pinned `packageManager`;
- `pnpm-workspace.yaml`;
- strict shared `tsconfig.base.json`;
- root ESLint flat configuration;
- root Prettier configuration and ignore file;
- package scripts with meaningful root orchestration;
- useful `.gitignore`;
- no Turborepo, Nx, or equivalent framework.

Create these application/package areas:

```text
apps/web
apps/api
packages/shared
packages/database
e2e
```

Root commands must include:

```text
dev, build, lint, typecheck, test, test:api, test:web, test:e2e,
db:generate, db:migrate, db:seed, db:reset, docker:up, docker:down
```

### R2 — Local Environment And PostgreSQL Infrastructure

Create Docker Compose local infrastructure with:

- PostgreSQL 16-compatible container;
- persistent named development volume;
- health check;
- development database `appsolo_client_hub_dev`;
- isolated test database `appsolo_client_hub_test`;
- safe local example credentials only;
- optional administration container only when it provides demonstrated value.

Create safe `.env.example` files and Zod-based environment parsing for web and API according to `markdown/contracts/ENVIRONMENT.md`.

The API must fail fast on invalid configuration and must refuse production startup with development auth enabled.

### R3 — Database Package, Schema, Migrations, And Seed

Create `packages/database` using Drizzle ORM and a PostgreSQL driver compatible with the documented architecture.

Implement the full initial schema from `markdown/contracts/DATA_MODEL.md`:

- users;
- organizations;
- organization memberships;
- projects;
- change requests;
- estimates;
- comments;
- status history;
- time entries;
- attachments.

Include enums, UUID keys, UTC timestamps, foreign keys, uniqueness, checks, and indexes.

Create:

- generated, checked-in initial migration;
- explicit migration command;
- idempotent or clearly resettable seed command;
- safe development reset command that cannot target a non-local database accidentally.

Seed all required users, organizations, memberships, project data, change requests, estimate, comments, and status history with clearly fake email addresses.

### R4 — Shared Contracts

Create `packages/shared` with runtime-safe Zod schemas and TypeScript contracts for:

- IDs and common pagination values;
- `AuthenticatedUser`;
- change-request priorities and statuses;
- create-change-request input;
- change-request list/detail DTOs;
- standard success and error envelopes;
- safe validation error details.

Create the provider-neutral `AttachmentStorage` service interface described in `markdown/contracts/INTEGRATIONS.md`. Do not implement uploads, local file persistence, signed URLs, or AWS types.

Shared schemas must be usable by React and Express without importing database, browser-only, or server-only code.

### R5 — Express API Foundation

Create the Express TypeScript API with:

- separate app composition and listener startup;
- versioned `/api/v1` routes;
- JSON body limit;
- explicit CORS;
- common security headers;
- request ID middleware;
- Pino structured logging with redaction;
- centralized 404 and error middleware;
- typed application errors;
- graceful startup/shutdown for the database pool;
- no raw stack, SQL, or configuration details in responses.

Implement `GET /api/v1/health` with a real database readiness query and safe `503` behavior.

### R6 — Development Authentication And Tenant Authorization

Implement development-only authentication middleware that:

- receives identity through `x-dev-user-id` or a configured development fallback;
- loads and validates an active database user;
- attaches only the provider-neutral `AuthenticatedUser` context;
- returns `401` for missing/unknown/inactive identity;
- cannot run in production.

Create an explicit authorization service or module that verifies:

- active authenticated user;
- active organization;
- active organization membership;
- active project;
- a P001-allowed role.

Internal AppSolo membership alone must not grant global client access. Internal users need a scoped client-organization membership.

Every change-request route must use the authorization path. Repositories must receive or include the authorized organization/project scope as defense in depth.

### R7 — Change-Request API Vertical Slice

Implement:

```text
GET  /api/v1/projects/:projectId/change-requests
GET  /api/v1/change-requests/:changeRequestId
POST /api/v1/projects/:projectId/change-requests
```

Follow `markdown/contracts/API.md` exactly unless the human approves a revision.

Create use-case rules:

- list uses deterministic ordering and validated limit/offset;
- detail returns one authorized request;
- create accepts only title, description, priority, and optional requested completion date;
- server supplies project, submitter, status, IDs, and timestamps;
- create status is `SUBMITTED`;
- create and initial status-history insertion use one transaction;
- client-provided unknown write fields are rejected;
- unauthorized access returns no resource data.

Controllers remain thin, services own authorization/business behavior, and repositories own Drizzle queries.

### R8 — React Dashboard Vertical Slice

Create the React/Vite application with:

- React Router;
- TanStack Query;
- React Hook Form;
- shared Zod validation;
- global design tokens and CSS Modules;
- a professional, simple SaaS dashboard shell;
- AppSolo Client Hub branding;
- sidebar navigation;
- current organization indicator;
- project heading or selector appropriate to the single seeded project;
- change-request list route;
- change-request detail route;
- change-request creation form.

The frontend must show:

- loading state;
- empty state;
- populated list state;
- field-level validation;
- submitting/disabled state;
- creation success feedback;
- forbidden/not-found handling;
- generic retryable error state.

On successful creation, update or invalidate TanStack Query data so the user can see the saved request. A refresh must load it from PostgreSQL.

A development identity selector is optional. When omitted, document how to change `VITE_DEV_AUTH_USER_ID` to test another seeded user.

### R9 — Tests And Validation

Use:

- Vitest;
- Supertest;
- React Testing Library and user-event;
- Playwright.

Required meaningful tests:

- health endpoint with database available;
- safe health failure when database is unavailable or mocked unavailable;
- environment validation success and failure;
- shared change-request input validation boundaries;
- authorized creation persists request and status history;
- unauthorized project access is rejected;
- unauthorized change-request detail is rejected;
- list returns only authorized project data in deterministic order;
- basic frontend form behavior and validation;
- Playwright smoke from seeded list through persisted creation and refresh.

Do not write tests that only assert private function calls or implementation details.

### R10 — Documentation, Git Boundary, And Handoff

Update the root README so it accurately documents the implemented application:

- product summary;
- architecture and repository structure;
- prerequisites and verified versions;
- installation and environment setup;
- PostgreSQL startup;
- migration, seed, reset, development, test, and build commands;
- local URLs;
- simulated-user behavior and seeded identities;
- troubleshooting;
- current limitations;
- planned AWS architecture.

Keep `markdown/` canonical and update contracts when implementation changes documented behavior.

Before review:

- run all validation;
- inspect the complete diff;
- create an immutable candidate commit;
- record candidate SHA;
- write `notes/P001/implementation-handoff.md` with exact commands/results;
- set P001 to `review_pending`;
- do not mark P001 complete;
- do not push or create a remote.

## Acceptance Criteria

- AC1 maps to R1: `pnpm install` succeeds and every required root script invokes real tooling or real package scripts.
- AC2 maps to R2: `pnpm docker:up` produces a healthy PostgreSQL service with distinct development and test databases.
- AC3 maps to R2: invalid API environment fails before listener startup, and production plus development auth is rejected.
- AC4 maps to R3: the checked-in migration creates the documented schema, constraints, and indexes without destructive reset behavior.
- AC5 maps to R3: `pnpm db:seed` creates the required fake multi-role, multi-tenant data and can be rerun safely or after a documented reset.
- AC6 maps to R4: web and API import one shared create schema/DTO contract without platform coupling, and the attachment storage boundary contains no AWS types or operational upload behavior.
- AC7 maps to R5: health returns `200` with database readiness and safe `503` without leaking driver details.
- AC8 maps to R5: all API failures use the documented envelope and include request correlation.
- AC9 maps to R6: a seeded authorized user can access the project, while another tenant's authenticated user receives a denial and no resource data.
- AC10 maps to R6: production configuration cannot activate development-auth middleware.
- AC11 maps to R7: list, detail, and create routes persist and return the documented DTOs and metadata.
- AC12 maps to R7: request creation and initial status history commit or roll back together.
- AC13 maps to R8: a user can submit a valid request in the browser and see the persisted result after refresh.
- AC14 maps to R8: loading, empty, validation, success, forbidden/not-found, and generic error states are implemented and testable.
- AC15 maps to R9: required tests execute against isolated test data and pass without AWS or internet services.
- AC16 maps to R10: README, contracts, phase record, candidate SHA, and implementation handoff match the actual candidate.

## Binding Decisions

- Use a pnpm workspace without a monorepo framework.
- Use React/Vite and CSS Modules with global design tokens.
- Use Express REST routes under `/api/v1`.
- Use Drizzle with PostgreSQL.
- Use Pino structured logging.
- Use the provider-neutral auth contract from ADR-0002.
- Use membership-based tenant access from ADR-0003.
- Use PostgreSQL numeric plus decimal strings for money from ADR-0004.
- Use `markdown/` as the canonical documentation/control plane from ADR-0006.
- Create status `SUBMITTED` and initial history in one transaction.
- No AWS resources, SDKs, or production authentication in P001.

## Suggested Approach

Codex may refine these details after inspection:

- `pg` with `drizzle-orm/node-postgres`;
- `tsx` for TypeScript development scripts;
- `pino-http` for request logging;
- `helmet` for baseline headers;
- one authorization module shared by change-request services;
- route-level feature folders in React;
- Playwright `webServer` configuration for local API and web startup.

These are not permission to create generic frameworks or unrelated abstractions.

## Invariants

- The frontend never authorizes access by itself.
- No user can access another client tenant without an active scoped membership.
- Development auth is impossible in production configuration.
- No real credential is committed or logged.
- No AWS dependency is required to run or test locally.
- No currency field is implemented as floating-point storage/arithmetic.
- No destructive migration or reset can target an arbitrary database silently.
- API responses never expose stack traces or raw database errors.
- Shared packages remain platform-neutral.
- Existing unrelated user work is preserved.
- Codex does not mark its own phase complete.

## Non-Goals

- NG1: Cognito, real login, password reset, or production sessions.
- NG2: S3 file upload/download or AWS SDK installation.
- NG3: SES email.
- NG4: ECS, ECR, RDS, Amplify, CloudWatch, Secrets Manager, IAM, Terraform, CDK, or CloudFormation.
- NG5: Estimate creation/approval APIs or UI.
- NG6: Comment, time-entry, attachment, release-note, or status-transition APIs beyond initial status history.
- NG7: Billing, payments, invoicing, subscriptions, or multi-currency.
- NG8: A large UI component framework or full design system.
- NG9: Microservices, queues, caching, GraphQL, event sourcing, CQRS, or PostgreSQL row-level security.
- NG10: GitHub remote creation, push, or deployment workflow.

## Likely Affected Areas

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
eslint.config.*
prettier.config.*
.gitignore
.env.example
docker-compose.yml
docker/
apps/api/
apps/web/
packages/database/
packages/shared/
e2e/
README.md
markdown/
notes/P001/
scripts/
```

Codex must inspect before assuming this list is complete.

## Data And Migration Impact

- Schema change: initial schema creation.
- Backward compatibility: no prior application data exists; preserve any unexpected existing database/code and report conflicts.
- Rollback/recovery: development reset may recreate only allowlisted local databases; migration rollback is not required if Drizzle does not generate it, but destructive operations are prohibited.
- Seed impact: required fake multi-tenant dataset.
- Export/import impact: none.

## Dependencies And Environment

### Expected Application Dependencies

Frontend:

- React and React DOM;
- React Router;
- TanStack Query;
- Zod;
- React Hook Form and Zod resolver.

API/database:

- Express;
- Drizzle ORM and Drizzle Kit;
- PostgreSQL driver;
- Zod;
- Pino/request logging;
- CORS and small security-header middleware.

Testing/tooling:

- TypeScript;
- ESLint and Prettier;
- Vitest;
- Supertest;
- React Testing Library and user-event;
- Playwright;
- TypeScript runtime tooling as needed.

### External Services

None. Local Docker PostgreSQL is the only infrastructure dependency.

## Automated Validation

- V1: `node scripts/check-scaffolding.mjs` passes before implementation and after documentation updates.
- V2: `pnpm install` succeeds and creates a lockfile.
- V3: `pnpm docker:up` reports healthy PostgreSQL; development and test database connectivity is proven.
- V4: `pnpm db:migrate` applies the initial migration to development; the test setup applies migrations to test.
- V5: `pnpm db:seed` creates the required dataset; rerun behavior is safe and documented.
- V6: `pnpm lint` passes with real ESLint execution.
- V7: `pnpm typecheck` passes for every workspace package with strict TypeScript.
- V8: `pnpm test` passes meaningful unit tests.
- V9: `pnpm test:api` passes health, validation, persistence, list/detail, and tenant-denial integration tests.
- V10: `pnpm test:web` passes the user-observable form test.
- V11: `pnpm build` produces production builds for web, API, shared, and database packages as applicable.
- V12: `pnpm exec playwright install chromium` completes or the environment already has the required browser.
- V13: `pnpm test:e2e` passes the seeded list/create/refresh smoke path.
- V14: a direct request to `/api/v1/health` returns the documented response while the assembled system runs.
- V15: `node scripts/generate-phase-index.mjs --check` passes.
- V16: `git diff --check <base_sha>..<candidate_sha>` passes.

## Human QA

- Q1 — Startup: on the human's normal development machine, follow README from a clean application state and confirm web, API, and PostgreSQL start using documented commands.
- Q2 — Seeded List: use the default authorized client user and confirm the seeded project and several differently styled request statuses appear.
- Q3 — Valid Creation: create a request with an optional completion date, observe success, open its detail, refresh, and confirm persistence.
- Q4 — Validation: submit empty/short title and description and confirm accessible field-level messages without an API write.
- Q5 — Unauthorized Tenant: switch to the seeded unrelated/unauthorized user configuration and confirm list, detail, and create access are denied without showing tenant data.
- Q6 — API Failure: stop PostgreSQL or otherwise trigger a safe API/database failure and confirm the UI shows a useful retry state while the API exposes no raw error.
- Q7 — Responsive/Keyboard Check: use keyboard navigation and a narrow desktop/mobile-width browser viewport to verify the primary dashboard and form remain usable.
- Q8 — Regression/Restart: restart the local stack and confirm seeded and newly created development data behave as documented for the chosen volume/reset workflow.

## Deliverables

- Local working monorepo and vertical slice.
- Checked-in migration and seed.
- Meaningful automated tests and Playwright smoke.
- Accurate root README and updated contracts.
- Updated P001 phase record.
- Immutable candidate commit.
- `notes/P001/implementation-handoff.md` prepared for Claude.

## Open Human Decisions

None are required to begin P001.

Codex must stop only if current repository evidence contradicts the assumed blank implementation, a required tool cannot be used without changing architecture, or a requested change would violate a binding decision.
