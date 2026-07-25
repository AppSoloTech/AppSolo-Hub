# Claude Review — P001

> Status: Complete. Independent review of the immutable candidate range.

## Review Target

- Base SHA: `2769ccd4a429425e778b070ea98f6fd241188a0f` (exists, on `main`)
- Candidate SHA: `e656d900a0462511e3e8293bcfc2dababb599ba5` (exists, `P001: implement local foundation vertical slice`)
- Reviewed range: `git diff 2769ccd4a429425e778b070ea98f6fd241188a0f..e656d900a0462511e3e8293bcfc2dababb599ba5` (110 files, +11253 / -141)
- Prompt: `prompts/active/P001-local-foundation-and-change-request-vertical-slice.md`, `spec_version: 1`, approved
- Working tree at review time: clean at `1fb4320` (`P001: record candidate handoff`). `e656d90..1fb4320` touches only `markdown/CURRENT_STATE.md`, `markdown/PHASE_INDEX.md`, the P001 phase record, and `notes/P001/implementation-handoff.md`. No application source differs between the candidate and the tree that was executed, so rerun results are attributable to the candidate.
- Uncommitted work did not supply any reviewed behavior.

## Validation Rerun

All commands were run by Claude against the working tree described above.

| Command                                                                                           | Result      | Notes                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git cat-file -t <base>`, `<candidate>`                                                           | Passed      | Both SHAs resolve to commits.                                                                                                                          |
| `git diff --check <base>..<candidate>`                                                            | Passed      | No whitespace errors.                                                                                                                                  |
| `node scripts/check-scaffolding.mjs`                                                              | Passed      | 27 required files, 11 phase records.                                                                                                                   |
| `node scripts/generate-phase-index.mjs --check`                                                   | Passed      | `PHASE_INDEX.md is current.`                                                                                                                           |
| `pnpm lint`                                                                                       | Passed      | Real ESLint (`eslint .`), exit 0.                                                                                                                      |
| `pnpm typecheck`                                                                                  | Passed      | Strict `tsc` for shared, database, api, web.                                                                                                           |
| `pnpm test`                                                                                       | Passed      | 4 tests (shared 2, database 2).                                                                                                                        |
| `pnpm test:api`                                                                                   | Passed      | 8 tests across `env.test.ts` (3), `app.test.ts` (2), `change-requests.integration.test.ts` (3), against `appsolo_client_hub_test`.                     |
| `pnpm test:web`                                                                                   | Passed      | 1 React Testing Library test.                                                                                                                          |
| `pnpm build`                                                                                      | Passed      | shared, database, api `tsc`; web Vite production bundle.                                                                                               |
| `pnpm test:e2e`                                                                                   | Passed      | 1 Playwright test, real Chromium against live web + API + PostgreSQL.                                                                                  |
| `pnpm exec prettier --check .`                                                                    | **Failed**  | 60 files violate the repository's own Prettier config. See C12.                                                                                        |
| `pnpm docker:up`                                                                                  | **Not run** | Docker/Compose is unavailable in this environment (`docker: command not found`), as it was for Codex. AC2 has no execution evidence from either agent. |
| Manual probe: `pnpm dev` from an unbuilt `packages/database`                                      | **Failed**  | `ERR_MODULE_NOT_FOUND`. See C2.                                                                                                                        |
| Manual probe: malformed JSON body, 1.2 MiB body, unknown route, unknown user, cross-tenant detail | Mixed       | Findings C5 and C6.                                                                                                                                    |
| Manual probe: `resolvedDatabaseUrl` with the committed `.env.example` values                      | **Failed**  | Test paths resolve to the development database. See C1.                                                                                                |

Codex's recorded validation table is honest about what it ran and about the Docker gap; every command it claims to have passed also passed here. The handoff's claim that "test commands reset only the allowlisted local test database" is the one statement that is not true under the documented configuration (C1).

## Findings

### C1 — Documented `.env` setup makes `pnpm test:api` and `pnpm test:e2e` destroy the development database

- Severity: **Blocker**
- Requirement or invariant: `markdown/TESTING.md` ("Test setup may migrate and truncate the test database, but it must never reset the development database"; "Development and test databases must be separate"); `markdown/REVIEW_CHECKLIST.md` ("Development and test databases are isolated"); prompt invariant "No destructive migration or reset can target an arbitrary database silently"; AC15.
- Evidence:
  - [packages/database/src/index.ts:10-18](packages/database/src/index.ts#L10-L18) — `resolvedDatabaseUrl` returns `environment.DATABASE_URL` first and **ignores `APPSOLO_DB_NAME` entirely** whenever `DATABASE_URL` is present.
  - [packages/database/package.json:15](packages/database/package.json#L15) — `"test:prepare": "APPSOLO_DB_NAME=appsolo_client_hub_test tsx src/reset.ts"` is the only mechanism that redirects the destructive reset to the test database.
  - [packages/database/src/reset.ts:4-10](packages/database/src/reset.ts#L4-L10) — resolves through the same function, then runs `DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;`. Its allowlist accepts **both** `appsolo_client_hub_dev` and `appsolo_client_hub_test`, so a misdirected reset passes the guard.
  - [.env.example:6](.env.example#L6) — ships `DATABASE_URL=postgresql://appsolo:appsolo_local_only@localhost:5432/appsolo_client_hub_dev`, and [README.md:36](README.md#L36) instructs `cp .env.example .env`.
  - [apps/api/src/modules/change-requests/change-requests.integration.test.ts:8,13](apps/api/src/modules/change-requests/change-requests.integration.test.ts#L8) — `resolvedDatabaseUrl({ ...process.env, APPSOLO_DB_NAME: 'appsolo_client_hub_test' })` followed by `TRUNCATE TABLE ... CASCADE` in `beforeEach`, with the same precedence defect.
  - [e2e/playwright.config.ts:3](e2e/playwright.config.ts#L3) — the Playwright API server uses the same `APPSOLO_DB_NAME` override and is subject to the same defect.
- Impact: A developer who follows the README (Docker Compose path or any `.env` containing `DATABASE_URL`) and runs `pnpm test:api` or `pnpm test:e2e` drops the `public` schema of `appsolo_client_hub_dev` and re-seeds it. All local development data is lost without warning, and the guard reports success because the dev database name is allowlisted. The test suite also silently stops being isolated.
- Reproduction: With `.env` copied from `.env.example`, `node -e` on the built package returns the development URL for the test-path override:
  ```
  resolvedDatabaseUrl({ DATABASE_URL: '...appsolo_client_hub_dev', APPSOLO_DB_NAME: 'appsolo_client_hub_test' })
    -> postgresql://appsolo:appsolo_local_only@localhost:5432/appsolo_client_hub_dev
  ```
  Codex's own runs passed only because the machine's `.env` uses `DB_*` components and has no `DATABASE_URL`; that is the configuration the guard happens to survive, not the documented one.
- Recommended correction: Stop inferring the test database from a name-component override. Resolve test paths from an explicitly injected test URL (`TEST_DATABASE_URL`, already documented and already present in `.env.example`), fail loudly when it is missing, and make `test:prepare` and the integration/E2E setup refuse any target whose database name is not `appsolo_client_hub_test`. Keep `appsolo_client_hub_dev` allowlisted only for the operator-invoked `pnpm db:reset`.

### C2 — `pnpm dev` fails from a clean checkout because `@appsolo/database` is never built

- Severity: **High**
- Requirement or invariant: AC1 ("every required root script invokes real tooling or real package scripts"); R10 README accuracy; Q1 startup.
- Evidence:
  - [package.json:7](package.json#L7) — `"dev": "pnpm --filter @appsolo/shared build && concurrently ... @appsolo/api dev ... @appsolo/web dev"`. Only `@appsolo/shared` is built.
  - [packages/database/package.json:6](packages/database/package.json#L6) — the package's `exports` map points at `./dist/index.js`, `./dist/schema.js`, `./dist/seed.js`, which exist only after `pnpm --filter @appsolo/database build`.
  - No `postinstall`/`prepare` script builds it, and `db:migrate`/`db:seed` run `tsx` against `src/`, so they do not populate `dist/`.
- Impact: The documented startup sequence (`pnpm install` → `cp .env.example .env` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`) crashes the API. `pnpm test:e2e` has the same exposure, because its Playwright `webServer` starts `@appsolo/api dev` after building only `@appsolo/shared`. Existing environments hide this because `pnpm typecheck` and `pnpm build` leave `dist/` behind.
- Reproduction: `mv packages/database/dist /tmp/backup && pnpm dev` →
  ```
  [api] Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../@appsolo/database/dist/index.js'
        imported from apps/api/src/server.ts
  ```
- Recommended correction: Build `@appsolo/database` wherever `@appsolo/shared` is built (`dev`, `test:e2e`, and the Playwright API `webServer` command), or add a workspace `prepare`/`postinstall` build for both library packages.

### C3 — Several required API integration cases are absent

- Severity: **High**
- Requirement or invariant: `markdown/TESTING.md` "Required P001 cases"; R6 ("returns `401` for missing/unknown/inactive identity"); R9; AC9; AC11; `markdown/REVIEW_CHECKLIST.md` testing section.
- Evidence: [apps/api/src/modules/change-requests/change-requests.integration.test.ts](apps/api/src/modules/change-requests/change-requests.integration.test.ts) contains exactly three cases — transactional create, list/detail denial, and the validation envelope. Missing, against the contract's explicit list:
  - unauthorized user **cannot create** under another tenant (only list and detail denial are asserted; `POST` denial is untested although AC9 covers create);
  - the **detail route's authorized success path** — there is no positive `GET /api/v1/change-requests/:id` assertion anywhere in the API suite, despite AC11 covering detail;
  - **deterministic ordering** — line 27 asserts only `toHaveLength(2)` and matching `projectId`; the `createdAt DESC, id DESC` contract in `markdown/contracts/API.md` is never checked, so an ordering regression passes;
  - **`401` behavior** for missing, unknown, or inactive identity — the authenticate middleware at [apps/api/src/app.ts:30-40](apps/api/src/app.ts#L30-L40) has no automated coverage (I confirmed `401` manually, but the candidate does not prove it);
  - health against a **real database** — [apps/api/src/app.test.ts:6-7](apps/api/src/app.test.ts#L6-L7) injects `checkDatabase` and passes `db: {} as never`, so `db.execute('select 1')` in [apps/api/src/app.ts:43](apps/api/src/app.ts#L43) is never exercised by any test.
- Impact: The phase's central safety claim — tenant denial across every route — rests on two of three routes, and the detail read path and list ordering ship untested. Regressions in create-authorization or ordering would be invisible to `pnpm test:api`.
- Reproduction: Read the file; count the `it(` blocks against the TESTING.md required list.
- Recommended correction: Add the four missing integration cases plus a real-database health assertion. They are cheap: the fixture, app, and seed helpers already exist.

### C4 — `TEST_DATABASE_URL` and `apps/api/.env.example` are shipped but never read

- Severity: Medium
- Requirement or invariant: `markdown/contracts/ENVIRONMENT.md` (`TEST_DATABASE_URL` table row; "Expected files after P001"); `markdown/TESTING.md` ("Integration and E2E test processes use `TEST_DATABASE_URL` or an explicitly injected test URL"); AC16.
- Evidence: `TEST_DATABASE_URL` appears only in [.env.example:7](.env.example#L7) and [apps/api/.env.example:4](apps/api/.env.example#L4); no `.ts` file references it (the API schema at [apps/api/src/config/env.ts:13-17](apps/api/src/config/env.ts#L13-L17) omits it). Separately, [apps/api/src/config/env.ts:5](apps/api/src/config/env.ts#L5) loads only the repository-root `.env`, so a developer who copies `apps/api/.env.example` to `apps/api/.env` — which `markdown/contracts/ENVIRONMENT.md` lists as a supported file — gets no effect at all, and README only mentions the root and web files.
- Impact: The documented isolation mechanism is inert, which is the contract-level face of C1. Configuration files that do nothing are a standing source of support confusion and false confidence.
- Reproduction: `grep -rn TEST_DATABASE_URL --include='*.ts' .` returns nothing.
- Recommended correction: Wire `TEST_DATABASE_URL` into the test paths as part of the C1 fix, and either make `apps/api/.env` actually load or delete `apps/api/.env.example` and correct `ENVIRONMENT.md`.

### C5 — Malformed and oversized request bodies return `500 INTERNAL_ERROR`

- Severity: Medium
- Requirement or invariant: `markdown/contracts/API.md` stable error-code table (`VALIDATION_ERROR` 400 for external input failures); AC8; `markdown/REVIEW_CHECKLIST.md` ("Error codes and HTTP statuses are consistent"; "Request size limits exist").
- Evidence: [apps/api/src/app.ts:53-58](apps/api/src/app.ts#L53-L58) maps only `AppError` and `ZodError`; the `status`/`type` carried by `express.json()` body-parser errors is discarded, and every other error becomes `INTERNAL_ERROR` / 500.
- Impact: A truncated payload or a body above the 1 MiB limit is reported to the client as a server fault and logged as `unhandled request error`. Clients cannot distinguish "you sent bad input" from "the server broke", and the limit that does exist produces misleading telemetry.
- Reproduction: against the running API,
  ```
  POST /api/v1/projects/<seeded>/change-requests  --data '{"title": "broken'   -> 500 INTERNAL_ERROR
  POST /api/v1/projects/<seeded>/change-requests  (1.2 MiB body)              -> 500 INTERNAL_ERROR
  ```
- Recommended correction: In the error middleware, translate body-parser failures (`err.type === 'entity.parse.failed'` → 400 `VALIDATION_ERROR`; `entity.too.large` → 413) before the generic fallback.

### C6 — Change-request detail leaks cross-tenant existence through the 403/404 split

- Severity: Medium
- Requirement or invariant: `markdown/contracts/SECURITY.md` ("Authentication failures should avoid exposing whether another tenant resource exists"); Product Vision "Tenant Safety Is Foundational".
- Evidence: [apps/api/src/modules/change-requests/service.ts:9](apps/api/src/modules/change-requests/service.ts#L9) — `detail` first calls `findRequestProject(id)`, which is **not scoped by user** ([repository.ts:14](apps/api/src/modules/change-requests/repository.ts#L14)), returns `NOT_FOUND` when no row exists, and only then authorizes, returning `FORBIDDEN` when the row exists but is out of scope.
- Impact: An authenticated user of any tenant can probe change-request UUIDs and distinguish "exists elsewhere" (403) from "does not exist" (404). No row content leaks, so this is disclosure of existence only, but it is exactly the oracle the security contract asks P001 to avoid.
- Reproduction: as the unrelated seeded user `20000000-…-000000000005`:
  ```
  GET /api/v1/change-requests/30000000-0000-4000-8000-000000000001  -> 403
  GET /api/v1/change-requests/30000000-0000-4000-8000-0000000000ff  -> 404
  ```
- Recommended correction: Return the same status for both cases on the detail route — a single scoped lookup that joins project → organization → membership and yields `404` (or uniformly `403`) whenever the caller is not authorized, decided once and documented in `markdown/contracts/API.md`.

### C7 — Tenant-denial evidence uses a user with no memberships, not a user from another tenant

- Severity: Medium
- Requirement or invariant: `markdown/contracts/SECURITY.md` ("P001 must test an authenticated user from another client tenant"); `markdown/REVIEW_CHECKLIST.md` ("Tests use at least two tenants/users and prove denial"); AC9.
- Evidence: [packages/database/src/seed.ts:21-25](packages/database/src/seed.ts#L21-L25) creates memberships for four users; `seedIds.otherTenantUser` receives **none**, and only one `CLIENT` organization exists ([seed.ts:18-19](packages/database/src/seed.ts#L18-L19)). The denial assertions at [change-requests.integration.test.ts:28-30](apps/api/src/modules/change-requests/change-requests.integration.test.ts#L28-L30) therefore prove "a user with no membership is denied", not "a member of tenant A cannot reach tenant B". Equally, both internal users hold scoped client memberships, so the ADR-0003 rule that internal-organization membership alone grants nothing is also unexercised.
- Impact: The scoping join at [repository.ts:11](apps/api/src/modules/change-requests/repository.ts#L11) does look correct, but the two authorization mistakes most likely to appear later — dropping the `organizationId` correlation, or treating internal membership as global — would both still pass this suite.
- Reproduction: Inspect the seed; `otherTenantUser` has no row in `organization_memberships`.
- Recommended correction: Seed a second `CLIENT` organization with its own project and a member, and an internal-only user with no client membership. Assert denial for both against the Northstar project's list, detail, and create routes.

### C8 — Contract-required environment validation proofs are missing or vacuous

- Severity: Medium
- Requirement or invariant: `markdown/contracts/ENVIRONMENT.md` "Environment Validation Requirements" (all six bullets are stated as things P001 tests must prove); AC3.
- Evidence:
  - [apps/web/src/env.ts](apps/web/src/env.ts) exports `parseWebEnvironment` but no test file exists anywhere under `apps/web` for it; `pnpm test:web` runs one form test. "web environment rejects a missing or invalid API base URL" is unproven.
  - [apps/api/src/config/env.test.ts:6](apps/api/src/config/env.test.ts#L6) merges the two required cases into one assertion, `toThrow('PORT')`. Because it deletes `DATABASE_URL` **and** corrupts `PORT` in the same call and only matches on `PORT`, removing `DATABASE_URL` from the schema entirely would not fail this test. The title also claims "without echoing values" while asserting nothing about that.
- Impact: Two contract-mandated proofs are absent, and a third is written so it cannot fail for the reason it names.
- Reproduction: Delete `DATABASE_URL: z.string().url()` from the API schema and rerun `pnpm test:api` — the suite still passes.
- Recommended correction: Split the API case into separate missing-`DATABASE_URL` and invalid-`PORT` assertions, assert the thrown message contains no credential substring, and add a small `parseWebEnvironment` test for missing and non-URL `VITE_API_BASE_URL`.

### C9 — The dashboard hardcodes the seeded tenant and project names

- Severity: Medium
- Requirement or invariant: R8 ("current organization indicator; project heading or selector appropriate to the single seeded project"); Product Vision invariant that a user must never be shown another organization's context.
- Evidence: [apps/web/src/layouts/DashboardLayout.tsx:2](apps/web/src/layouts/DashboardLayout.tsx#L2) renders the literal `Northstar Demo Co.` and `Client administrator`; [ChangeRequestList.tsx:5](apps/web/src/features/change-requests/ChangeRequestList.tsx#L5) and [NewChangeRequest.tsx:4](apps/web/src/features/change-requests/NewChangeRequest.tsx#L4) render the literal eyebrow `Northstar client portal`. None of these read the loaded project or the authenticated identity, and the API never returns project or organization names (`ProjectScope` fetches `projectName`/`organizationName` at [repository.ts:11](apps/api/src/modules/change-requests/repository.ts#L11) but the service discards them).
- Impact: The organization indicator is decoration, not information. Any route with a different `:projectId`, or any change of `VITE_DEV_AUTH_USER_ID` for the Q5 tenant test, still labels the page "Northstar Demo Co." — precisely the wrong signal in a product whose first principle is tenant safety. It also guarantees rework in P002.
- Reproduction: Load `/projects/<any-uuid>/change-requests`; the sidebar and eyebrow are unchanged.
- Recommended correction: Return the already-fetched project and organization names in the list/detail `meta`, and render the indicator from that data (falling back to a neutral placeholder while loading).

### C10 — Frontend forbidden handling branches on the API's error message text

- Severity: Medium
- Requirement or invariant: AC14 ("forbidden/not-found … states are implemented and testable"); `markdown/REVIEW_CHECKLIST.md` frontend section.
- Evidence: [ChangeRequestList.tsx:4](apps/web/src/features/change-requests/ChangeRequestList.tsx#L4) compares `query.error.message === 'You do not have access to this project.'` — an exact string match against the message thrown by [service.ts:7](apps/api/src/modules/change-requests/service.ts#L7). [api.ts:3](apps/web/src/api.ts#L3) already carries `ApiError.status`, which is never consulted. [ChangeRequestDetail.tsx:2](apps/web/src/features/change-requests/ChangeRequestDetail.tsx#L2) collapses 403, 404, and 500 into one sentence.
- Impact: Rewording a server message — expected as P002 refines copy — silently downgrades the forbidden state to the generic "We could not load change requests." No test covers either branch, so the regression would be invisible.
- Reproduction: Change the service message; the UI shows the generic error for a legitimate 403.
- Recommended correction: Branch on `error instanceof ApiError && error.status === 403 / 404`, and add a component test for the forbidden branch.

### C11 — Creation success feedback is declared but not implemented

- Severity: Low
- Requirement or invariant: R8 ("creation success feedback"); AC14.
- Evidence: [NewChangeRequest.tsx:3](apps/web/src/features/change-requests/NewChangeRequest.tsx#L3) navigates with `{ state: { created: true } }`, but [ChangeRequestDetail.tsx](apps/web/src/features/change-requests/ChangeRequestDetail.tsx) never reads `useLocation().state`. The success style `.notice` in [global.css](apps/web/src/styles/global.css) is defined and referenced nowhere.
- Impact: The user's only confirmation is the route change. The dead `state` and unused style show the intended confirmation was dropped rather than deliberately omitted.
- Reproduction: Create a request; no success message appears on the detail page.
- Recommended correction: Read the navigation state on the detail route and render the existing `.notice` element once, or remove the dead state and style and record the decision.

### C12 — Committed source violates the repository's own Prettier configuration

- Severity: Low
- Requirement or invariant: R1 ("root Prettier configuration"); `markdown/REVIEW_CHECKLIST.md` maintainability.
- Evidence: `pnpm exec prettier --check .` reports **60 files** with style issues, including nearly every source file. [prettier.config.mjs](prettier.config.mjs) sets `printWidth: 110`, yet e.g. [packages/database/src/schema.ts](packages/database/src/schema.ts) is 23 lines holding 8.3 KB (single lines over 1,000 characters), and [apps/api/src/app.ts](apps/api/src/app.ts) packs whole middleware bodies onto one line. `pnpm lint` does not check formatting, so nothing catches this.
- Impact: The declared standard and the committed code disagree from day one. Reviewing, blaming, and diffing multi-statement single lines is materially harder, and the first `pnpm format` run will produce a large unrelated diff over the phase's code.
- Reproduction: `pnpm exec prettier --check .` → exit 1.
- Recommended correction: Run `pnpm format` and commit the result, then add `prettier --check .` to `pnpm lint` so the standard is enforced rather than aspirational.

### C13 — Backend composition collapses the documented module boundaries into one file

- Severity: Low
- Requirement or invariant: `markdown/ARCHITECTURE.md` "Backend Composition" (recommended shape: `config/`, `errors/`, `logging/`, `middleware/`, `modules/health/`, `modules/change-requests/{routes,controller,service,repository}`); R5.
- Evidence: [apps/api/src/app.ts](apps/api/src/app.ts) contains request-ID middleware, Pino setup, Helmet/CORS/JSON wiring, the authentication middleware, the health module, all three route handlers, the 404 handler, and the error handler. There is no `middleware/`, `logging/`, or health module, and no routes or controller file for change requests.
- Impact: The layering the architecture document describes — and that P002-P005 will extend with more routes and a real auth adapter — does not exist yet, so the first follow-on phase pays the split cost. Note the substance is right: services own authorization, repositories own Drizzle, and handlers stay thin, so this is placement, not design.
- Reproduction: `ls apps/api/src`.
- Recommended correction: Extract request-ID/logging/authentication middleware and the health route into their own modules when P002 adds the Cognito-shaped adapter; no abstraction layer is needed, only file boundaries.

### C14 — `users.email` is not normalized to lowercase

- Severity: Low
- Requirement or invariant: `markdown/contracts/DATA_MODEL.md` users table ("stored lowercase") and its "unique normalized email index".
- Evidence: [packages/database/src/schema.ts:14](packages/database/src/schema.ts#L14) declares `unique('users_email_unique').on(t.email)` over the raw column; the migration emits `CONSTRAINT "users_email_unique" UNIQUE("email")`. No `lower()` expression index and no normalization in code.
- Impact: `Owner@appsolo.test` and `owner@appsolo.test` can coexist. P001 creates no users through the API so the risk is latent, but P002 invitations will inherit it.
- Reproduction: Insert two rows differing only in case; both succeed.
- Recommended correction: Normalize on write and add a unique index on `lower(email)`, or amend the data-model contract if plain uniqueness is now intended.

### C15 — Small type-safety and rendering rough edges

- Severity: Low
- Requirement or invariant: `markdown/REVIEW_CHECKLIST.md` ("`any`, unsafe assertions … are absent or justified").
- Evidence:
  - [ChangeRequestList.tsx:5](apps/web/src/features/change-requests/ChangeRequestList.tsx#L5) — `styles[item.status]` has a CSS Modules class only for `AWAITING_ESTIMATE`, so every other status renders `class="status undefined"`.
  - [apps/api/src/app.test.ts:6-7](apps/api/src/app.test.ts#L6) — `db: {} as never` defeats the type system rather than using a narrow fake.
  - [apps/api/src/app.ts:48-50](apps/api/src/app.ts#L48-L50) — `request.authenticatedUser!` three times; the router-level `authenticate` makes this safe today, but a typed request or a small accessor would make it checked.
  - Pino emits `requestId` twice per request line (once from `customProps`, once from the serializer), visible in the `pnpm test:api` output.
- Impact: Cosmetic and low-risk individually; each is a small future trap.
- Reproduction: Inspect the rendered list markup; read the noted lines.
- Recommended correction: Give every status a class or drop the per-status lookup; replace `as never` with a minimal typed stub; remove the duplicate `requestId` property.

## Requirements And Invariants

| Item                      | Result               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 workspace/tooling      | Met with defects     | pnpm workspace, strict `tsconfig.base.json` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), flat ESLint, all 14 required root scripts present; `dev` is broken from clean (C2) and Prettier is unenforced (C12).                                                                                                                                                                                                             |
| R2 environment/PostgreSQL | Partly unproven      | Compose file, health check, named volume, `docker/init-test-db.sql`, Zod config with production dev-auth guard all present; Compose never executed (AC2); `TEST_DATABASE_URL` inert (C4); isolation broken under documented `.env` (C1).                                                                                                                                                                                                 |
| R3 schema/migration/seed  | Met                  | All ten tables, enums, UUID keys, `timestamptz`, `numeric(12,2)`/`numeric(8,2)`, FKs `ON DELETE restrict`, all contract checks and indexes present in `0000_spicy_leader.sql`; migration is create-only; seed is idempotent via `onConflictDoNothing` and fake `.test` domains. Email normalization missing (C14); reset allowlist too broad (C1).                                                                                       |
| R4 shared contracts       | Met                  | `packages/shared` is Zod-only, imports nothing platform-specific, and is consumed by both web and API; `AttachmentStorage` is provider-neutral with no upload behavior.                                                                                                                                                                                                                                                                  |
| R5 Express foundation     | Met with defects     | Helmet, explicit array CORS, 1 MiB JSON limit, request ID with format validation, Pino with `authorization`/`cookie`/`x-dev-user-id` redaction (verified in test output), `x-powered-by` disabled, typed `AppError`, central 404/error, real `select 1` readiness with safe 503, graceful shutdown. Body-parser errors mis-mapped (C5); composition inlined (C13).                                                                       |
| R6 dev auth/authorization | Met with test gaps   | Dev auth is config-gated and cannot start in production; middleware loads and status-checks the real user and exposes only `{ userId, email }`; `findProjectScope` requires an active `CLIENT` organization, active project, and a membership row on that organization, so internal-only membership grants nothing. Denial evidence is thin (C7); `401` untested (C3).                                                                   |
| R7 change-request API     | Met with defects     | All three routes, `.strict()` input rejecting unknown fields, server-owned `projectId`/`submittedByUserId`/`status`/timestamps, `SUBMITTED` + history in one `db.transaction`, `createdAt DESC, id DESC` ordering, validated `limit`/`offset`. Detail existence oracle (C6).                                                                                                                                                             |
| R8 React dashboard        | Met with defects     | Router, TanStack Query with invalidation, RHF + shared Zod resolver, design tokens + CSS Modules, sidebar/brand, loading/empty/list/validation/submitting/error states, `aria-invalid` and `role="alert"` on errors, responsive breakpoint. Hardcoded tenant context (C9), message-based forbidden branch (C10), missing success notice (C11).                                                                                           |
| R9 tests                  | **Not met**          | Layers exist and all pass, but several TESTING.md-required cases and both ENVIRONMENT.md-required validation proofs are absent (C3, C8).                                                                                                                                                                                                                                                                                                 |
| R10 docs/Git/handoff      | Met with corrections | README, contracts, phase record, candidate SHA, and handoff are consistent and the Docker gap is disclosed honestly; the "test commands reset only the allowlisted local test database" claim is inaccurate (C1) and `TEST_DATABASE_URL`/`apps/api/.env.example` are documented but inert (C4).                                                                                                                                          |
| AC1                       | Pass with defect     | All root scripts real; `dev` broken from clean (C2).                                                                                                                                                                                                                                                                                                                                                                                     |
| AC2                       | **Unproven**         | Docker unavailable to Codex and to this review. Missing evidence, not a pass. Human Q1/Q8 must verify.                                                                                                                                                                                                                                                                                                                                   |
| AC3                       | Pass                 | `pnpm test:api` proves production + dev auth is rejected and that parsing fails before listen; weakened by C8.                                                                                                                                                                                                                                                                                                                           |
| AC4                       | Pass                 | Migration reviewed line by line and applied cleanly; create-only.                                                                                                                                                                                                                                                                                                                                                                        |
| AC5                       | Pass                 | Seed rerun without duplicates observed in `test:api` (per-test re-seed) and `test:e2e`.                                                                                                                                                                                                                                                                                                                                                  |
| AC6                       | Pass                 | Single shared create schema used by both sides; no AWS types anywhere (`grep -riE "aws\|s3\|cognito\|@aws-sdk"` over `apps/`, `packages/`, `e2e/` returns nothing).                                                                                                                                                                                                                                                                      |
| AC7                       | Pass                 | 200 readiness verified live; 503 verified by test with the driver message asserted absent from the body.                                                                                                                                                                                                                                                                                                                                 |
| AC8                       | **Fail**             | Body-parser failures return `INTERNAL_ERROR`/500 (C5). Request correlation itself is correct on every response.                                                                                                                                                                                                                                                                                                                          |
| AC9                       | Partial              | Denial proven for list and detail; create denial untested and the "other tenant" user has no tenant (C3, C7).                                                                                                                                                                                                                                                                                                                            |
| AC10                      | Pass                 | `parseApiConfig` throws on `NODE_ENV=production` with `DEV_AUTH_ENABLED=true`; middleware also refuses when the flag is off.                                                                                                                                                                                                                                                                                                             |
| AC11                      | Partial              | List and create verified; detail has no automated test and ordering is unasserted (C3).                                                                                                                                                                                                                                                                                                                                                  |
| AC12                      | Pass                 | Single `db.transaction` verified in code and by the persisted-history assertion.                                                                                                                                                                                                                                                                                                                                                         |
| AC13                      | Pass                 | Playwright create-then-reload passed here against the real stack.                                                                                                                                                                                                                                                                                                                                                                        |
| AC14                      | Partial              | Forbidden/not-found and success paths are the weak ones (C10, C11).                                                                                                                                                                                                                                                                                                                                                                      |
| AC15                      | **Fail**             | Tests run without AWS or network, but test-data isolation is not guaranteed under the documented configuration (C1).                                                                                                                                                                                                                                                                                                                     |
| AC16                      | Partial              | Accurate except the isolation claim and the inert environment files (C1, C4).                                                                                                                                                                                                                                                                                                                                                            |
| Invariants                | Mostly held          | Frontend never authorizes; API owns enforcement; no cross-tenant row data returned; dev auth impossible in production; no credential committed (`.env` ignored via `**/.env` with `!**/.env.example`); no AWS dependency; money stored as `numeric` and seeded as decimal strings with no float arithmetic; responses carry no stack traces or SQL. **Violated:** "no destructive reset can target an arbitrary database silently" (C1). |
| NG1-NG10                  | Held                 | No Cognito/login, no upload or AWS SDK, no SES, no infrastructure code, no estimate/comment/time/attachment routes, no billing, no UI framework, no microservices/queues/GraphQL/RLS. NG10: an `origin` remote pre-exists the base commit (`origin/main` = `2769ccd`, the base SHA) and was not created by this phase; `phase/P001-local-foundation` was never pushed and no deployment workflow was added.                              |

## Architecture, Data, Privacy, And Security

- Architecture: Package boundaries and dependency direction match `ARCHITECTURE.md` — `shared` imports only Zod, `database` imports no controllers, `web` and `api` both depend on `shared`, and `api` depends on `database`. No circular dependencies. The backend file layout is flattened (C13) but the layering responsibilities are respected.
- Data integrity: The migration is a faithful, create-only rendering of `DATA_MODEL.md`, including both trimmed-length checks on `change_requests`, all listed indexes with correct `DESC` ordering, and `ON DELETE restrict` throughout. Currency is `numeric(12,2)`/`numeric(8,2)` handled as decimal strings; no floating-point currency arithmetic exists anywhere in the candidate.
- Tenant isolation: The single scoping query correlates project → organization → membership and additionally requires `organizations.type = 'CLIENT'`, an active organization, and an active project, so internal-organization membership alone grants nothing. Repository reads are project-scoped as defense in depth. The weaknesses are evidentiary (C7) and the existence oracle on detail (C6), not the core query.
- Authentication guard: Provider-neutral and correctly gated. Business modules see only `{ userId, email }`; the `x-dev-user-id` header is honored only behind the config flag and only after an `ACTIVE` user lookup; production startup is impossible with dev auth enabled.
- Logging/error safety: Verified live — `x-dev-user-id` renders as `[Redacted]`, no connection string or SQL appears in any response, and the 503 test asserts the driver message is absent from the body. Stack traces appear only in local logs, which the security contract permits. The error-code mapping gap is C5.
- Dependencies/environment: Local PERN plus testing tooling only; no AWS package, no network dependency in any test.

## Scope And Maintainability

- Scope drift: None found. The diff is P001 work plus control-plane evidence; nothing from P002-P011 leaked in, and no unrelated refactor obscures the phase.
- Unnecessary complexity: None. No base repository or service framework, no speculative abstraction; the `AttachmentStorage` interface is the only forward-looking seam and it is required by R4.
- Deferred risk: The largest maintainability drag is formatting (C12) and the flattened API composition (C13), both cheap to fix now and progressively more expensive later. C9 will force UI rework in P002 when a second tenant becomes reachable.

## Verdict (initial review — superseded by the focused re-review below)

`changes requested`

C1 is a Blocker: following the repository's own README destroys the developer's database on the next test run, and the guard reports success while doing it. C2 and C3 are High: the documented startup path fails from a clean checkout, and several contract-required authorization and route tests are absent, so the phase's central tenant-safety claim is under-evidenced. AC2 additionally has no execution evidence from either agent and must be treated as missing until human QA covers Q1/Q8.

The underlying implementation is otherwise sound — the schema is a faithful rendering of the contract, the authorization query is correct, the transaction and error envelope behave as specified, and every command I reran passed. The blocking issues are configuration and coverage defects, not design defects.

---

# Focused Re-Review — Accepted Review Fixes

## Re-Review Target

- Candidate SHA: `e656d900a0462511e3e8293bcfc2dababb599ba5`
- Review-fix SHA: `82e16fce38c69ea7e8961a654ccdeaeb4f06c07a` (exists, `P001: address accepted review findings`)
- Reviewed range: `git diff e656d900a0462511e3e8293bcfc2dababb599ba5..82e16fce38c69ea7e8961a654ccdeaeb4f06c07a` (68 files, +2115 / -603)
- Working tree at re-review time: clean at `e1f1bd2` (`P001: record review-fix handoff`). `82e16fc..e1f1bd2` touches only `markdown/PHASE_INDEX.md`, the P001 phase record, `notes/P001/*`, and a Prettier-only reformat of `scripts/generate-phase-index.mjs`. No application source differs between the fix commit and the tree I executed.
- Disposition source: `notes/P001/review-disposition.md` — all of C1-C15 `Accepted`, none rejected or deferred.
- Scope of this pass: every accepted finding, plus regression and scope-drift checks across the fix diff. Per `markdown/FLOW.md` step 9 this is mandatory for the Blocker and High items; I verified all fifteen because the human accepted all fifteen.

## Validation Rerun

| Command                                                                                                                | Result                 | Notes                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `git cat-file -t 82e16fc`                                                                                              | Passed                 | Fix SHA exists.                                                                                                     |
| `pnpm lint`                                                                                                            | Passed                 | Now `eslint . && prettier --check .`; `All matched files use Prettier code style!`                                  |
| `pnpm typecheck`                                                                                                       | Passed                 | Four packages, strict.                                                                                              |
| `pnpm test`                                                                                                            | Passed                 | 5 tests (shared 2, database 3).                                                                                     |
| `pnpm test:api`                                                                                                        | Passed                 | 11 tests — `env.test.ts` (4), `app.test.ts` (3), `change-requests.integration.test.ts` (4).                         |
| `pnpm test:web`                                                                                                        | Passed                 | 5 tests — `env.test.ts` (3), `ChangeRequestList.test.tsx` (1), `NewChangeRequest.test.tsx` (1).                     |
| `pnpm build`                                                                                                           | Passed                 | All four packages; Vite production bundle.                                                                          |
| `pnpm test:e2e`                                                                                                        | Passed                 | 1 Playwright test against the real stack.                                                                           |
| `pnpm --filter @appsolo/database generate`                                                                             | **Failed expectation** | Re-emits migration `0001`'s statements as a new `0002`. See R1. Generated files were deleted and the tree restored. |
| `pnpm docker:up`                                                                                                       | **Not run**            | Docker still unavailable. AC2 remains without execution evidence.                                                   |
| Probe: test-URL resolution under four configurations                                                                   | Passed                 | See C1 below.                                                                                                       |
| Probe: `test:prepare` with `TEST_DATABASE_URL` aimed at the dev database                                               | Passed                 | Guard refuses.                                                                                                      |
| Probe: `pnpm dev` with both package `dist/` directories deleted                                                        | Passed                 | See C2 below.                                                                                                       |
| Probe: live malformed / oversized bodies, cross-tenant detail, internal-only user, list `meta`, ordering, log contents | Mixed                  | C5/C6/C7/C9 confirmed fixed; R7 found.                                                                              |

Codex's recorded test counts (5 / 11 / 5) match exactly what I observed.

## Accepted-Fix Verification

| Finding | Severity | Status              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1      | Blocker  | **Verified fixed**  | See detail below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| C2      | High     | **Verified fixed**  | See detail below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| C3      | High     | **Verified fixed**  | See detail below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| C4      | Medium   | Verified fixed      | `TEST_DATABASE_URL` is now the primary test target ([index.ts:20-29](packages/database/src/index.ts#L20-L29)); [config/env.ts:6-10](apps/api/src/config/env.ts#L6-L10) loads `apps/api/.env` with `override: true`, so the shipped `apps/api/.env.example` is no longer inert; README documents the copy step.                                                                                                                                                                                                                                                        |
| C5      | Medium   | Verified fixed      | [app.ts:46-56](apps/api/src/app.ts#L46-L56) maps `entity.parse.failed` → 400 and `entity.too.large` → 413, and suppresses the bogus `unhandled request error` log. Live: malformed → `400 VALIDATION_ERROR` with `details: [{path: "body"}]`; 1.2 MiB body → `413`. Covered by a test ([app.test.ts:33-45](apps/api/src/app.test.ts#L33-L45)). Residual naming issue in R4.                                                                                                                                                                                           |
| C6      | Medium   | Verified fixed      | [repository.ts:53-76](apps/api/src/modules/change-requests/repository.ts#L53-L76) `findAuthorizedById` joins project → organization → membership in one scoped query; [service.ts:41-45](apps/api/src/modules/change-requests/service.ts#L41-L45) returns `404` uniformly. Live probe as the Acme member: existing-elsewhere `404`, nonexistent `404` — the oracle is gone. Asserted at [integration.test.ts:82](apps/api/src/modules/change-requests/change-requests.integration.test.ts#L82).                                                                       |
| C7      | Medium   | Verified fixed      | Seed now creates a real second tenant (`Acme Demo Co.` + `Acme client portal`) with `otherTenantUser` as its `CLIENT_MEMBER`, plus `internalOnlyUser` holding only an `INTERNAL` membership ([seed.ts:14-144](packages/database/src/seed.ts#L14-L144)). Both are asserted denied (`403`) at [integration.test.ts:71-85](apps/api/src/modules/change-requests/change-requests.integration.test.ts#L71-L85); I reproduced both live. This now proves membership scoping and the ADR-0003 internal-membership rule, not merely "no membership".                          |
| C8      | Medium   | Verified fixed      | [env.test.ts](apps/api/src/config/env.test.ts) splits missing-`DATABASE_URL` from invalid-`PORT` and asserts the thrown message does **not** contain a planted credential; new [apps/web/src/env.test.ts](apps/web/src/env.test.ts) covers missing and non-URL `VITE_API_BASE_URL`.                                                                                                                                                                                                                                                                                   |
| C9      | Medium   | **Partially fixed** | List page and shell are now data-driven ([service.ts:32-38](apps/api/src/modules/change-requests/service.ts#L32-L38) returns `projectName`/`organizationName`; [ChangeRequestList.tsx:26-36](apps/web/src/features/change-requests/ChangeRequestList.tsx#L26-L36) renders them; sidebar literal replaced with "Authorized workspace"). Live `meta` confirmed. **Residual: R2.**                                                                                                                                                                                       |
| C10     | Medium   | Verified fixed      | [ChangeRequestList.tsx:17](apps/web/src/features/change-requests/ChangeRequestList.tsx#L17) and [ChangeRequestDetail.tsx:18](apps/web/src/features/change-requests/ChangeRequestDetail.tsx#L18) branch on `ApiError.status`; `ApiError` now carries `code` ([api.ts:3-11](apps/web/src/api.ts#L3-L11)). New [ChangeRequestList.test.tsx](apps/web/src/features/change-requests/ChangeRequestList.test.tsx) deliberately throws a 403 whose message is `'Different text'` and asserts the forbidden copy still renders — exactly the regression the finding described. |
| C11     | Low      | Verified fixed      | [ChangeRequestDetail.tsx:6-7,29-33](apps/web/src/features/change-requests/ChangeRequestDetail.tsx#L29-L33) reads the navigation state and renders the previously-unused `.notice` with `role="status"`.                                                                                                                                                                                                                                                                                                                                                               |
| C12     | Low      | Verified fixed      | `pnpm lint` now runs `prettier --check .`; the whole tree passes, including the previously non-compliant 60 files. Contract and README table churn in this commit is Prettier reformatting only — I diffed `DATA_MODEL.md`, `API.md`, `ENVIRONMENT.md`, `TESTING.md`, and `scripts/` and found no substantive content change except the ENVIRONMENT.md test-database rule, which correctly documents the new behavior.                                                                                                                                                |
| C13     | Low      | Verified fixed      | `middleware/request-id.ts`, `middleware/development-auth.ts`, `modules/health/health.routes.ts`, and `modules/change-requests/change-request.routes.ts` now exist; `app.ts` is composition only.                                                                                                                                                                                                                                                                                                                                                                      |
| C14     | Low      | Verified fixed      | Additive migration [0001_normalized_email.sql](packages/database/drizzle/0001_normalized_email.sql) adds `users_email_lowercase` CHECK and a unique index on `lower(email)`; `0000_spicy_leader.sql` is byte-identical to the candidate and `0000_snapshot.json` is semantically identical (formatting only), so no already-applied migration was rewritten. **But see R1.**                                                                                                                                                                                          |
| C15     | Low      | **Partially fixed** | `styles[item.status]` replaced with a single `.status` class; `request.authenticatedUser!` replaced by a throwing `userId()` accessor ([change-request.routes.ts:6-9](apps/api/src/modules/change-requests/change-request.routes.ts#L6-L9)); duplicate `requestId` log field removed. `db: {} as never` remains at [app.test.ts:16,27,34](apps/api/src/app.test.ts#L16). The de-duplication also introduced **R7**.                                                                                                                                                   |

### C1 — verified fixed (Blocker)

`resolvedTestDatabaseUrl` ([index.ts:20-29](packages/database/src/index.ts#L20-L29)) never consults `DATABASE_URL`, `DB_NAME`, or `APPSOLO_DB_NAME`; it uses `TEST_DATABASE_URL` or pins the literal `appsolo_client_hub_test` onto the `DB_*` components. `test:prepare` now runs [test-reset.ts](packages/database/src/test-reset.ts), whose guard requires a local host and the exact `appsolo_client_hub_test` name, and `db:reset` is narrowed to `appsolo_client_hub_dev` only ([reset.ts:6-12](packages/database/src/reset.ts#L6-L12)). The integration suite and the Playwright API server both go through the test resolver.

Four probes against the built package, using the committed `.env.example` values that triggered the original Blocker:

```
A  DATABASE_URL=dev + TEST_DATABASE_URL=test  -> .../appsolo_client_hub_test     (was: .../dev)
B  DATABASE_URL=dev only, no DB_*             -> THROWS "TEST_DATABASE_URL is required ..."
C  DB_* + APPSOLO_DB_NAME=dev + DB_NAME=other -> .../appsolo_client_hub_test
D  resolvedDatabaseUrl (dev path) unchanged   -> .../appsolo_client_hub_dev
E  test:prepare with TEST_DATABASE_URL=dev    -> "test:prepare only permits the local appsolo_client_hub_test database."
```

Case B is the important one: the failure mode is now a loud error rather than a silent fallback onto the development database.

### C2 — verified fixed (High)

`dev`, `typecheck`, and `test:e2e` all build `@appsolo/database` as well as `@appsolo/shared` ([package.json:7,10,14](package.json#L7)). I deleted **both** `packages/database/dist` and `packages/shared/dist` and ran `pnpm dev`: zero `ERR_MODULE_NOT_FOUND`, and both processes started (`API listening at http://localhost:4000`, `VITE ready in 106 ms`). The tree was restored afterwards.

### C3 — verified fixed (High)

All five gaps are closed in [change-requests.integration.test.ts](apps/api/src/modules/change-requests/change-requests.integration.test.ts) and [app.test.ts](apps/api/src/app.test.ts):

- real-database health (`200` against the live test database) and `401` for both a missing identity and an unknown UUID — lines 32-39;
- authorized detail success — lines 67-70;
- cross-tenant **create** denial (`403`) — lines 75-84;
- deterministic ordering — line 66 asserts `[requestTwo, requestOne]`. This is a genuine check: both seeded rows share a `createdAt` (one transaction, `now()`), so it exercises the `id DESC` tiebreak specifically;
- internal-only user denial — line 85.

## New And Residual Findings

### R1 — Migration `0001` has no Drizzle snapshot, so `db:generate` will re-emit it

- Severity: **Medium**
- Requirement or invariant: `markdown/contracts/DATA_MODEL.md` ("Drizzle schema definitions and checked-in migrations are authoritative"; migrations must not be destructive or conflicting); R3.
- Evidence: `packages/database/drizzle/meta/` contains only `0000_snapshot.json` and `_journal.json`, while `_journal.json` lists both `0000_spicy_leader` and `0001_normalized_email`. `0001_normalized_email.sql` was hand-authored rather than produced by `drizzle-kit generate`, so no `0001_snapshot.json` exists.
- Impact: Drizzle diffs the schema against the newest snapshot it has, which is `0000`. The next `pnpm db:generate` — in P002 or any later phase — silently reintroduces the `0001` statements into the new migration. Applying that migration to any database that already ran `0001` fails on the duplicate index/constraint, which will look like a P002 defect rather than a P001 one.
- Reproduction: `pnpm --filter @appsolo/database generate` on the fix commit produced `0002_petite_purifiers.sql` containing exactly:
  ```sql
  CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));
  ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"));
  ```
  (I deleted the generated files and restored `_journal.json`; the tree is clean.)
- Recommended correction: Regenerate the email change through `drizzle-kit generate` so the matching `0001_snapshot.json` is checked in, or add the snapshot for the hand-written migration. Nothing about the applied SQL needs to change.

### R2 — `NewChangeRequest` still hardcodes the seeded project name (residual C9)

- Severity: Low
- Requirement or invariant: R8 project heading; the same Product Vision tenant-context concern as C9.
- Evidence: [NewChangeRequest.tsx:30](apps/web/src/features/change-requests/NewChangeRequest.tsx#L30) still renders the literal eyebrow `Northstar client portal`, although the list page and sidebar are now driven by API `meta`. The create page never fetches project context.
- Impact: The creation form labels every project "Northstar client portal". Smaller than the original finding — the list and shell are correct now — but C9 named this file explicitly and it was not changed.
- Recommended correction: Reuse the cached list `meta` (same query key) or drop the eyebrow on the create page.

### R3 — `APPSOLO_USE_TEST_DATABASE` is undocumented and bypasses validated configuration

- Severity: Low
- Requirement or invariant: `markdown/contracts/ENVIRONMENT.md` API variable table and "API startup validates configuration with Zod before opening a listener"; AC16.
- Evidence: [server.ts:5-8](apps/api/src/server.ts#L5-L8) reads `process.env.APPSOLO_USE_TEST_DATABASE` directly, outside the Zod schema, and redirects the whole API to the test database. It is set only by [e2e/playwright.config.ts:8](e2e/playwright.config.ts#L8) and appears in no `.env.example`, in `ENVIRONMENT.md`, or in the README.
- Impact: A new operational switch that changes which database the API serves is invisible to anyone reading the environment contract, and it is the one configuration input not validated at startup.
- Recommended correction: Add it to the ENVIRONMENT.md API table and to `.env.example` as a test-only flag, and parse it through the Zod schema alongside the rest.

### R4 — Two new response behaviors are not reflected in the API contract

- Severity: Low
- Requirement or invariant: `markdown/contracts/API.md` stable error-code table and P001 route descriptions; AC16.
- Evidence: [app.ts:54-55](apps/api/src/app.ts#L54-L55) returns code `VALIDATION_ERROR` with HTTP **413**, but the contract table pairs `VALIDATION_ERROR` with 400 only and lists no 413 row (the table was reformatted in this commit but not extended). Separately, the detail route now returns **404** where an unauthorized caller previously got 403 — the correct fix for C6 — yet `markdown/contracts/API.md` still documents only "Unauthorized access returns `403`" and says nothing about the detail route's uniform 404.
- Impact: A client implementing against the contract would treat `VALIDATION_ERROR` as always-400, and would expect 403 from the detail route. The behavior is right; the documentation is stale.
- Recommended correction: Add a `PAYLOAD_TOO_LARGE`/413 row (or document the 413 pairing explicitly) and state the detail route's uniform 404-on-unauthorized rule in the route section.

### R5 — `ChangeRequestRepository.findById` is now dead code

- Severity: Low
- Requirement or invariant: `markdown/REVIEW_CHECKLIST.md` maintainability.
- Evidence: [repository.ts:86-90](apps/api/src/modules/change-requests/repository.ts#L86-L90); the only reference in the repository is its own declaration — the C6 fix replaced its caller with `findAuthorizedById`.
- Impact: An unscoped-by-membership lookup left in the tenant-critical repository is exactly the method a future contributor might reach for by name.
- Recommended correction: Delete it.

### R6 — README seeded-identity table is out of date

- Severity: Low
- Requirement or invariant: R10 (README documents seeded identities); AC16; QA case Q5.
- Evidence: The README identity table still lists three identities and describes `…000005` only as "Denied from the seeded project". The seed now also creates `internalOnlyUser` (`…000006`, internal-organization `DEVELOPER`), and `…000005` is now a `CLIENT_MEMBER` of the new `Acme Demo Co.` tenant.
- Impact: The human running Q5 cannot tell from the README that there are now two distinct denial identities exercising two different rules.
- Recommended correction: Add the internal-only row and note the Acme tenant membership.

### R7 — The correlation request ID was dropped from structured request logs

- Severity: **Medium**
- Requirement or invariant: `markdown/ARCHITECTURE.md` ("A request-scoped logger includes request ID, method, route, status, duration, and authenticated user ID when available"); `markdown/contracts/API.md` Request Correlation ("Include it in structured request and error logs"); `markdown/contracts/SECURITY.md` ("Structured logs include request ID"); AC8.
- Evidence: The C15 de-duplication removed `requestId` from `customProps` entirely rather than removing the duplicate serializer field — [app.ts:35](apps/api/src/app.ts#L35) now reads `customProps: (request) => ({ userId: request.authenticatedUser?.userId })`. In the candidate it was `({ requestId: request.requestId, userId: ... })`.
- Impact: The UUID returned to the client in the `x-request-id` header and in `error.requestId` is no longer emitted as a log field. `req.id` in the log line is pino-http's per-process counter, not that UUID. Log lines written through `request.log.error` do not receive `customProps` at all, so an internal error cannot be tied to the ID the user was shown — which is the entire purpose of the correlation ID.
- Reproduction: From the live API log for a request whose response carried `x-request-id: 0fe7a4bd-…`:
  ```
  req.id                     = 1
  top-level requestId present = False
  ```
  The UUID survives only incidentally inside `res.headers` on request-completion lines.
- Recommended correction: Restore `requestId: request.requestId` in `customProps`, and if the duplicate must go, remove it from the serializer side instead — or bind it into the request child logger so error lines carry it too.

## Regression And Scope Checks

- No new dependency was added in the fix commit; every `package.json` change is Prettier reformatting plus the four script changes.
- `grep -riE "aws|@aws-sdk|cognito|s3"` across `apps/`, `packages/`, and `e2e/` still returns nothing. NG1-NG10 continue to hold; `phase/P001-local-foundation` is still unpushed and `origin/main` is still the base SHA.
- `0000_spicy_leader.sql` is unchanged and `0000_snapshot.json` is semantically identical, so no previously-applied migration was rewritten.
- Contract edits in the fix commit are formatting-only except the ENVIRONMENT.md test-database rule, which honestly documents the new behavior. No acceptance criterion was weakened to fit the implementation.
- The one code change outside the fix commit (`scripts/generate-phase-index.mjs` in `e1f1bd2`) is a Prettier reformat.
- Live re-probe confirmed no request body content, credential, or connection string appears in the API log output.

## Updated Requirement Status

- R9 (tests) moves from **not met** to met: the TESTING.md required case list and both ENVIRONMENT.md validation proofs are now covered, and the denial evidence uses two real tenants.
- AC8 moves from **fail** to met for status/code mapping; the correlation half is now weakened by R7.
- AC9, AC11, AC14, AC15, AC16 move from partial to met, except the documentation residuals in R3, R4, and R6.
- **AC2 is still unproven.** Docker was unavailable to Codex and to both of my passes. This is missing evidence, not a pass, and only human QA Q1/Q8 can close it.

## Verdict (first focused re-review — superseded by the second focused re-review below)

`ready with non-blocking observations`

The Blocker and both High findings are verified fixed by direct reproduction, not by reading the fix: the test paths can no longer resolve to the development database under any configuration I could construct, `pnpm dev` works from a fully unbuilt checkout, and the missing authorization, detail, ordering, and readiness tests now exist and fail for the right reasons. Every accepted Medium and Low is also fixed, with two partial applications noted (R2, and the `as never` remnant of C15).

Seven items remain for human disposition, none of them blocking: R1 and R7 are Medium and should be fixed before P002 begins, since one will surface as a spurious P002 migration conflict and the other quietly removes the operational thread that ties a user-visible error to a log line. R2-R6 are Low documentation and cleanup items.

AC2 remains unverified in this environment. P001 must not reach `complete` until human QA covers Q1 and Q8 against real Docker Compose, along with the remaining Q-cases.

---

# Second Focused Re-Review — Accepted Re-Review Corrections

## Re-Review Target

- Review-fix SHA: `82e16fce38c69ea7e8961a654ccdeaeb4f06c07a`
- Re-review-fix SHA: `bc45e4f7030f5521ddfc3a9e50c270da1a81c99d` (exists, `P001: address accepted re-review observations`)
- Reviewed range: `git diff 82e16fce38c69ea7e8961a654ccdeaeb4f06c07a..bc45e4f7030f5521ddfc3a9e50c270da1a81c99d` (23 files, +1701 / -158; of which `notes/P001/claude-review.md` is my own first re-review text)
- Working tree at re-review time: clean at `116e72d` (`P001: record re-review fix handoff`). `bc45e4f..116e72d` touches only the P001 phase record and `notes/P001/*`. No application source differs between the fix commit and the tree I executed.
- Disposition source: `notes/P001/review-disposition.md` — R1-R7 all `Accepted`.

## Validation Rerun

| Command                                                                                                       | Result      | Notes                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `git cat-file -t bc45e4f`                                                                                     | Passed      | Fix SHA exists.                                                                             |
| `pnpm lint`                                                                                                   | Passed      | ESLint + `prettier --check .`, both clean.                                                  |
| `pnpm typecheck`                                                                                              | Passed      | Four packages, strict.                                                                      |
| `pnpm test`                                                                                                   | Passed      | 5 tests (shared 2, database 3).                                                             |
| `pnpm test:api`                                                                                               | Passed      | 12 tests — `env.test.ts` (5), `app.test.ts` (3), `change-requests.integration.test.ts` (4). |
| `pnpm test:web`                                                                                               | Passed      | 5 tests.                                                                                    |
| `pnpm build`                                                                                                  | Passed      | All packages.                                                                               |
| `pnpm test:e2e`                                                                                               | Passed      | 1 Playwright test against the real stack.                                                   |
| `pnpm --filter @appsolo/database generate`                                                                    | Passed      | `No schema changes, nothing to migrate` — R1 confirmed.                                     |
| `node scripts/check-scaffolding.mjs`, `generate-phase-index.mjs --check`, `git diff --check 82e16fc..bc45e4f` | Passed      | Clean.                                                                                      |
| `pnpm docker:up`                                                                                              | **Not run** | Docker still unavailable. AC2 remains without execution evidence.                           |
| Probe: live request/error logging with an authenticated user, an unknown user, and a failing database         | Passed      | R7 confirmed — see below.                                                                   |
| Probe: real-browser deep link to `/projects/:projectId/change-requests/new`                                   | **Failed**  | Blank page, uncaught `TypeError`. See R8.                                                   |

Codex's recorded counts (5 / 12 / 5) match exactly what I observed.

## Accepted-Fix Verification

| Finding | Severity | Status                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | -------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1      | Medium   | **Verified fixed**           | `packages/database/drizzle/meta/0001_snapshot.json` is now checked in (1262 lines) and `_journal.json` matches. `pnpm --filter @appsolo/database generate` now reports `No schema changes, nothing to migrate 😴` where it previously emitted a duplicate `0002`. The applied SQL is unchanged.                                                                                                                                                                                                                                                      |
| R2      | Low      | **Fixed, but introduced R8** | [NewChangeRequest.tsx:20-27](apps/web/src/features/change-requests/NewChangeRequest.tsx#L20-L27) reads the cached list envelope instead of the literal, and the component test now seeds `Acme Demo Co. · Acme client portal` and asserts it renders. The seed literal is gone. The new cache read is unguarded — see R8.                                                                                                                                                                                                                            |
| R3      | Low      | Verified fixed               | `APPSOLO_USE_TEST_DATABASE` is now part of the Zod schema with a `false` default ([config/env.ts:31-34](apps/api/src/config/env.ts#L31-L34)), consumed as `config.APPSOLO_USE_TEST_DATABASE` in [server.ts](apps/api/src/server.ts), documented in the `ENVIRONMENT.md` API table plus an explicit "not an operator-facing development setting" note, and present in both `.env.example` files with a clarifying comment. A test asserts `'true'` parses and `'yes'` is rejected by name ([env.test.ts:26-33](apps/api/src/config/env.test.ts#L26)). |
| R4      | Low      | Verified fixed               | The 413 response now uses a dedicated `PAYLOAD_TOO_LARGE` code ([app.ts:60](apps/api/src/app.ts#L60)) and `markdown/contracts/API.md` gained the matching table row; the detail route section now states that a missing and an inaccessible request both return `404` so existence is not disclosed. `app.test.ts` asserts the new code. Live: `413` with `{"code":"PAYLOAD_TOO_LARGE"}`.                                                                                                                                                            |
| R5      | Low      | Verified fixed               | `findById` is deleted from the repository; no reference remains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R6      | Low      | Verified fixed               | README identity table now lists four identities, describes `…000005` as an Acme Demo Co. client member denied from Northstar, and adds `…000006` as the internal-only developer denied from all client projects.                                                                                                                                                                                                                                                                                                                                     |
| R7      | Medium   | **Verified fixed**           | See detail below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### R7 — verified fixed, including the error path

`customProps` now returns `{ requestId }` before authentication and `{ userId }` after it ([app.ts:38-41](apps/api/src/app.ts#L38-L41)), and the health route logs through `request.log` rather than the bare base logger ([health.routes.ts:13](apps/api/src/modules/health/health.routes.ts#L13)).

I confirmed the resulting behavior against a live API rather than inferring it. Authenticated `200` and unauthenticated `401` requests:

```
status=200  requestId='b59f280b-…'  userId='20000000-…-000000000003'  header='b59f280b-…'
status=401  requestId='4db5141b-…'  userId=None                       header='4db5141b-…'
```

Every line carries exactly one `requestId` (`awk` count = 1 per line, versus the duplicated key in the candidate), it matches the `x-request-id` response header, and the authenticated line also carries `userId` — so both contract requirements hold simultaneously.

The error path is now better than the candidate's. With the API pointed at an unreachable database:

```
response: 503, x-request-id: 685089c4-…, body error.requestId: 685089c4-…
log msg='database readiness check failed'  requestId='685089c4-…'   leaks connection string: False
log msg='request errored'                  requestId='685089c4-…'   leaks connection string: False
```

A user-visible error ID now ties directly to the internal log line, which is what the correlation requirement exists for. See R9 for a durability caveat about how this works.

## New Findings

### R8 — The create-request route crashes to a blank page when the list query is not cached

- Severity: **High**
- Requirement or invariant: R8 change-request creation form; AC13; AC14 ("loading, empty, validation, success, forbidden/not-found, and generic error states are implemented"); QA cases Q3 and Q4.
- Evidence: [NewChangeRequest.tsx:24-27](apps/web/src/features/change-requests/NewChangeRequest.tsx#L24-L27) destructures the cached envelope's `meta` directly:
  ```ts
  const requestList = queryClient.getQueryData<SuccessEnvelope<ChangeRequestDto[]>>([...]);
  const { organizationName = 'Authorized organization', projectName = 'Project' } = requestList?.meta as {...};
  ```
  When the list query has never run, `getQueryData` returns `undefined`, so `requestList?.meta` is `undefined`, and destructuring `undefined` throws a `TypeError`. The optional chain guards the property access but not the destructuring; the default values only apply once the right-hand side is an object. The `as` cast hides this from TypeScript, so `pnpm typecheck` cannot catch it.
- Impact: The route renders nothing. There is no error boundary in [main.tsx](apps/web/src/main.tsx), so React unmounts the whole tree — the sidebar and shell disappear too, not just the form. This happens on any direct navigation to the create URL, on a browser refresh while on the form, and in a new tab. A user who fills in the form, refreshes, or bookmarks the page loses the entire application view.
- Reproduction: with the app running, open `http://127.0.0.1:5173/projects/10000000-0000-4000-8000-000000000003/change-requests/new` directly in Chromium:
  ```
  h1 count:   0
  root text:  ""
  pageerror:  "Cannot read properties of undefined (reading 'organizationName')"
  ```
  No automated test catches it: the Playwright smoke reaches the form by clicking "New request" from the list (warm cache), and [NewChangeRequest.test.tsx:12-16](apps/web/src/features/change-requests/NewChangeRequest.test.tsx#L12) explicitly calls `queryClient.setQueryData(...)` before rendering, so both paths pre-populate the exact cache entry whose absence causes the crash.
- Recommended correction: Guard the read — `const { organizationName = '…', projectName = '…' } = (requestList?.meta ?? {}) as {…};` — and add a component test that renders the form with an empty `QueryClient`. Consider also fetching the project context on this route rather than depending on cache warmth, and adding a top-level error boundary so a future render error degrades to a message instead of a blank document.

### R9 — The request-ID logging fix depends on `pino-http` evaluating `customProps` twice

- Severity: Low
- Requirement or invariant: `markdown/contracts/SECURITY.md` and `markdown/ARCHITECTURE.md` structured-logging requirements; maintainability.
- Evidence: The ternary at [app.ts:38-41](apps/api/src/app.ts#L38-L41) can only ever return one of the two keys per call. Both appear on authenticated log lines because `pino-http@10.5.0` invokes `customProps` at two distinct points — once in `loggingMiddleware` when the request logger is built (before the auth middleware runs, yielding `{ requestId }`) and once in `onResFinished` (after auth, yielding `{ userId }`), where a string-comparison guard prevents re-binding an identical value. I verified both call sites in `node_modules/.pnpm/pino-http@10.5.0/node_modules/pino-http/logger.js:105,146`.
- Impact: The behavior is correct today and I verified it end to end, but it rests on an undocumented ordering detail of a third-party library. If a future `pino-http` evaluates `customProps` only at response time, authenticated request lines silently lose `requestId` — the exact regression R7 raised — and no test would fail, because no test asserts log contents.
- Recommended correction: Return both keys unconditionally (`{ requestId: request.requestId, userId: request.authenticatedUser?.userId }`) and remove the duplicate at its source, or bind `requestId` once via `pinoHttp`'s `genReqId`/`customAttributeKeys` instead of through `customProps`. A single assertion on a captured log line would also pin the behavior.

### R10 — `db: {} as never` remains in the API health tests (residual C15)

- Severity: Low
- Requirement or invariant: `markdown/REVIEW_CHECKLIST.md` ("`any`, unsafe assertions, and duplicated DTO types are absent or justified").
- Evidence: [app.test.ts:16,27,34](apps/api/src/app.test.ts#L16) still constructs the app with `db: {} as never`. C15 named this and it was not changed in either fix commit; the other three C15 items were addressed.
- Impact: Cosmetic today — the injected `checkDatabase` means the fake `db` is never touched. It becomes a trap if a future test in this file exercises a code path that does reach `db`, because the cast suppresses the compiler error that would otherwise point at it.
- Recommended correction: Replace with a minimal typed stub, or note in the disposition that the cast is accepted for these tests.

## Regression And Scope Checks

- No new dependency was added. The only non-P001-scope file touched is `scripts/generate-phase-index.mjs`, and that change (in the handoff commit) is a Prettier reformat.
- `grep -riE "aws|@aws-sdk|cognito|s3"` across `apps/`, `packages/`, and `e2e/` still returns nothing; NG1-NG10 continue to hold. The branch is still unpushed and `origin/main` is still the base SHA.
- `0000_spicy_leader.sql`, `0001_normalized_email.sql`, and `0000_snapshot.json` are unchanged by this commit — R1 was fixed by adding the missing snapshot, not by rewriting applied migrations.
- Contract edits are additive and accurate: the `PAYLOAD_TOO_LARGE` row, the detail-route 404 sentence, and the `APPSOLO_USE_TEST_DATABASE` row all describe behavior I observed. No acceptance criterion was weakened.
- I re-verified that the C1 isolation boundary still holds after these changes: `test:prepare` and the integration suite still resolve only through `resolvedTestDatabaseUrl`, and `pnpm test:api`/`pnpm test:e2e` still touch only `appsolo_client_hub_test`.
- Live re-probe confirmed no request body content, credential, or connection string appears in API log output, including the database-failure path.

## Verdict (second focused re-review — superseded by the third focused re-review below)

`changes requested`

R1 and R7 — the two Medium items that mattered — are verified fixed by direct reproduction, and R3-R6 are cleanly closed. The R7 fix in particular is now stronger than the original candidate, because the health-failure log line carries the same UUID the client was shown.

The blocking issue is R8, a High regression introduced by the R2 fix in this very commit: the change-request creation route now throws during render whenever the list query is not already cached, and with no error boundary the whole application unmounts to a blank page. Direct navigation, a refresh on the form, and opening the form in a new tab all hit it. Neither the Playwright smoke nor the component test can catch it, because both pre-populate the exact cache entry whose absence causes the crash — so this would most likely have surfaced first during human QA on Q3 or Q4. The fix is a one-line guard plus a test that renders the form with an empty cache.

R9 and R10 are Low and need only a disposition.

AC2 remains unverified in this environment. P001 must not reach `complete` until human QA covers Q1 and Q8 against real Docker Compose, along with the remaining Q-cases.

---

# Third Focused Re-Review — Accepted Second Re-Review Findings

## Re-Review Target

- Re-review-fix SHA: `bc45e4f7030f5521ddfc3a9e50c270da1a81c99d`
- Second re-review-fix SHA: `9693281` (exists, `P001: address accepted second re-review findings`)
- Reviewed range: `git diff bc45e4f7030f5521ddfc3a9e50c270da1a81c99d..9693281` (11 files, +302 / -51; source changes confined to `apps/api/src` and `apps/web/src`, the rest is control-plane evidence including my own second re-review text)
- Working tree at re-review time: clean at `4ab700a` (`P001: record second re-review fix handoff`). `9693281..4ab700a` touches only the P001 phase record and `notes/P001/*`.
- Disposition source: `notes/P001/review-disposition.md` — R8, R9, R10 all `Accepted`.

## Validation Rerun

| Command                                                                                                       | Result      | Notes                                                             |
| ------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `git cat-file -t 9693281`                                                                                     | Passed      | Fix SHA exists.                                                   |
| `pnpm lint`                                                                                                   | Passed      | ESLint + `prettier --check .`, both clean.                        |
| `pnpm typecheck`                                                                                              | Passed      | Four packages, strict.                                            |
| `pnpm test`                                                                                                   | Passed      | 5 tests (shared 2, database 3).                                   |
| `pnpm test:api`                                                                                               | Passed      | 12 tests.                                                         |
| `pnpm test:web`                                                                                               | Passed      | 6 tests — `NewChangeRequest.test.tsx` is now 2.                   |
| `pnpm build`                                                                                                  | Passed      | All packages.                                                     |
| `pnpm test:e2e`                                                                                               | Passed      | 1 Playwright test against the real stack.                         |
| `pnpm --filter @appsolo/database generate`                                                                    | Passed      | `No schema changes, nothing to migrate`.                          |
| `node scripts/check-scaffolding.mjs`, `generate-phase-index.mjs --check`, `git diff --check bc45e4f..9693281` | Passed      | Clean.                                                            |
| `pnpm docker:up`                                                                                              | **Not run** | Docker still unavailable. AC2 remains without execution evidence. |
| Probe: real-browser deep link to the create route with a cold cache                                           | Passed      | R8 confirmed — see below.                                         |
| Probe: live request/error logging, authenticated + unauthenticated + failing database                         | Passed      | R9 confirmed — see below.                                         |
| Probe: API database resolution with `apps/api/.env` present, as the README instructs                          | **Failed**  | See R12.                                                          |

## Accepted-Fix Verification

| Finding | Severity | Status                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | -------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R8      | High     | **Verified fixed**                  | [NewChangeRequest.tsx:23-24](apps/web/src/features/change-requests/NewChangeRequest.tsx#L23-L24) now destructures `(requestList?.meta ?? {})`, and a second component test renders the form with a bare `QueryClient` and asserts both the heading and the `Authorized organization · Project` fallback. Re-running the exact Chromium deep link that previously produced a blank page now yields `h1 count: 1`, the full shell and form, and `page errors: []`. |
| R9      | Low      | **Verified fixed**                  | The library-timing dependency is gone. [app.ts:41-44](apps/api/src/app.ts#L41-L44) now sets `genReqId: (request) => request.requestId`, `quietReqLogger: true`, and `customAttributeKeys: { reqId: 'requestId' }`, leaving `customProps` to contribute only `userId`. Correlation no longer relies on `customProps` being evaluated before authentication.                                                                                                       |
| R10     | Low      | Verified fixed, with an observation | `db: {} as never` is gone. `createApp` now takes a discriminated union and the health tests pass a structurally-typed `HealthDatabase` ([app.ts:17-31](apps/api/src/app.ts#L17-L31), [app.test.ts:15-26](apps/api/src/app.test.ts#L15-L26)). The unsafe cast the finding named no longer exists. See R11 for the cost.                                                                                                                                           |

### R8 — verified fixed

```
--- direct deep link to /projects/<seeded>/change-requests/new (cold query cache) ---
h1 count:   1
root text:  "AppSolo Client Hub … Authorized workspace … Change requests … ← Change requests …
             AUTHORIZED ORGANIZATION · PROJECT … New change request … Descr"
page errors: []
```

The new test also guards the regression at the unit level, and `afterEach(cleanup)` was added so the two cases in that file stay independent.

### R9 — verified fixed

Live requests through the assembled API — an authenticated `200`, an unknown-user `401`, and a health request:

```
status=200 requestId='7c6de50e-…' userId='20000000-…-000000000003' req.id='7c6de50e-…' header='7c6de50e-…'
status=401 requestId='3389e994-…' userId=None                      req.id='3389e994-…' header='3389e994-…'
status=200 requestId='88e6bed7-…' userId=None                      req.id='88e6bed7-…' header='88e6bed7-…'
```

Every line carries exactly one `"requestId"` key (`awk` count = 1 on each), and on each line it equals that request's own `x-request-id` response header. Pointing the API at an unreachable database still correlates the failure end to end:

```
response 503, x-request-id d93b7280-…, body error.requestId d93b7280-…
log msg='database readiness check failed'  requestId='d93b7280-…'  leaks database name: False
log msg='request errored'                  requestId='d93b7280-…'  leaks database name: False
```

## New Findings

### R12 — `apps/api/.env` overrides exported variables, so Playwright's test-database switch is silently disabled

- Severity: **High**
- Requirement or invariant: `markdown/TESTING.md` ("Development and test databases must be separate"; "Integration and E2E test processes use `TEST_DATABASE_URL` or an explicitly injected test URL"); `markdown/contracts/ENVIRONMENT.md` (`APPSOLO_USE_TEST_DATABASE` is a "validated test-only switch"); AC15.
- Evidence:
  - [apps/api/src/config/env.ts:6-10](apps/api/src/config/env.ts#L6-L10) loads `apps/api/.env` with `override: true`, which inverts the normal precedence — values in the file beat variables already exported into the process environment.
  - [apps/api/.env.example:2](apps/api/.env.example#L2) ships `APPSOLO_USE_TEST_DATABASE=false` and line 3 ships the development `DATABASE_URL`.
  - [README.md:37](README.md#L37) instructs `cp apps/api/.env.example apps/api/.env` as part of normal installation.
  - [e2e/playwright.config.ts:8](e2e/playwright.config.ts#L8) starts the API with `APPSOLO_USE_TEST_DATABASE=true` in the command environment — exactly the kind of value the `override: true` load discards.
- Impact: For any developer who followed the documented setup, `pnpm test:e2e` runs the API against **`appsolo_client_hub_dev`**. `test:prepare` still correctly resets only the test database, so the browser smoke then reads and writes the developer's development data instead — it creates a `Browser request <timestamp>` change request there on every run. The test still passes, because the development database is seeded identically, so nothing signals the loss of isolation. This is not destructive — no `DROP` or `TRUNCATE` reaches the development database — but it defeats the isolation guarantee AC15 asserts, under the configuration the README tells people to create.
- Reproduction: with `apps/api/.env` copied from the example, and `APPSOLO_USE_TEST_DATABASE=true` exported exactly as Playwright sets it:
  ```
  exported APPSOLO_USE_TEST_DATABASE=true
  config.APPSOLO_USE_TEST_DATABASE = false
  database the API would serve     = postgresql://appsolo:appsolo_local_only@localhost:5432/appsolo_client_hub_dev
  ```
  (The file was created for this probe and deleted afterwards; `apps/api/.env` is gitignored and the tree is clean.)
- Note on origin: the `override: true` load arrived with the C4 fix in `82e16fc` and became harmful in `bc45e4f`, when `APPSOLO_USE_TEST_DATABASE` moved into the dotenv-loaded configuration and into `apps/api/.env.example`. My second re-review verified R3's validation and documentation but did not test the interaction with the overriding loader; this pass did.
- Recommended correction: Load `apps/api/.env` without `override`, so explicitly exported variables win — that is the conventional precedence and it restores the Playwright switch. If per-app override is genuinely wanted for the other keys, exclude the test switch, or have Playwright inject `TEST_DATABASE_URL`/the database choice through a channel the loader cannot overwrite. A regression test that boots `parseApiConfig` with both an exported `true` and a file-provided `false` would pin the precedence.
- Related, pre-existing: `reuseExistingServer: !process.env.CI` in the Playwright config means a developer's already-running `pnpm dev` API (serving the development database) is reused for the smoke run. Worth closing in the same change.

### R11 — The R10 fix puts a test-only branch in the application composition root

- Severity: Low
- Requirement or invariant: `markdown/REVIEW_CHECKLIST.md` maintainability ("No speculative base repository/service framework was added"; "Functions and modules have focused responsibilities"); `markdown/ARCHITECTURE.md` backend composition.
- Evidence: `AppDependencies` is now a discriminated union on a `testOnly` flag, and [app.ts:66-75](apps/api/src/app.ts#L66-L75) branches on it, mounting a caller-supplied `changeRequestTestRouter` instead of the real authentication middleware and change-request router. Production call sites must now pass `testOnly: false` ([server.ts:9](apps/api/src/server.ts#L9), [change-requests.integration.test.ts:20](apps/api/src/modules/change-requests/change-requests.integration.test.ts#L20)).
- Impact: The application factory now has a mode that exists only for tests, and the health tests no longer assemble the real route stack — the malformed-body and oversized-body cases run against a stub router. Those assertions remain valid (the body parser throws before routing), so nothing is currently mistested; the cost is that the composition root is shaped by its tests and could drift further. This is a smaller problem than the `as never` it replaced, but it is a larger change than the finding required.
- Recommended correction: Consider testing `healthRouter` directly against a small express app in `health.routes.test.ts` and reverting `createApp` to a single dependency shape. This is a judgment call and a `Rejected` disposition would be entirely reasonable.

## Regression And Scope Checks

- No new dependency; no source file outside `apps/api/src` and `apps/web/src` changed in the fix commit.
- `grep -riE "aws|@aws-sdk|cognito|s3"` across `apps/`, `packages/`, and `e2e/` still returns nothing. NG1-NG10 hold; the branch is unpushed and `origin/main` is still the base SHA.
- Migrations untouched; `db:generate` still reports no pending changes, so R1 remains closed.
- I re-verified the C1 boundary: `test:prepare` and the API integration suite still resolve exclusively through `resolvedTestDatabaseUrl`, and both still reset/read only `appsolo_client_hub_test`. R12 affects the Playwright API server process, not the reset path — nothing destructive reaches the development database.
- Live probes confirmed no request body, credential, or connection string appears in API log output, including the database-failure path.

## Verdict (third focused re-review — superseded by the fourth focused re-review below)

`changes requested`

R8 is verified fixed in a real browser — the deep-linked create route renders the full shell with the neutral fallback and throws nothing — and it is now pinned by a component test that renders with an empty cache. R9 is verified fixed and is a genuine improvement: correlation now comes from `genReqId`/`customAttributeKeys` rather than from an incidental detail of when `pino-http` evaluates `customProps`. R10's unsafe cast is gone.

The blocking issue is R12: `apps/api/src/config/env.ts` loads `apps/api/.env` with `override: true`, so the `APPSOLO_USE_TEST_DATABASE=true` that Playwright exports is overwritten by the `false` shipped in `apps/api/.env.example` — the file the README tells every developer to create. Under the documented setup, `pnpm test:e2e` therefore runs the browser smoke against the development database and writes a new change request into it on every run, while still reporting success. It is not destructive, but it silently voids the isolation AC15 asserts, and it is the third variant of the same configuration-precedence problem in this phase. The fix is to drop `override` so exported variables win, plus a test that pins that precedence.

R11 is a Low observation about the shape of the R10 fix and may reasonably be rejected.

AC2 remains unverified in this environment. P001 must not reach `complete` until human QA covers Q1 and Q8 against real Docker Compose, along with the remaining Q-cases.

---

# Fourth Focused Re-Review — Accepted Third Re-Review Findings

## Re-Review Target

- Second re-review-fix SHA: `9693281`
- Third re-review-fix SHA: `29fdf5e` (exists, `P001: address accepted third re-review findings`)
- Reviewed range: `git diff 9693281..29fdf5e` — source changes confined to `apps/api/src`, `apps/web/src`, `e2e/playwright.config.ts`, `README.md`, and `markdown/contracts/ENVIRONMENT.md`
- Working tree at re-review time: clean at `f9986bd` (`P001: record third re-review fix handoff`). `29fdf5e..f9986bd` touches only the P001 phase record and `notes/P001/*`.
- Disposition source: `notes/P001/review-disposition.md` — R11 and R12 both `Accepted`.

## Validation Rerun

| Command                                                                                                       | Result      | Notes                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `git cat-file -t 29fdf5e`                                                                                     | Passed      | Fix SHA exists.                                                                                        |
| `pnpm lint`                                                                                                   | Passed      | ESLint + `prettier --check .`.                                                                         |
| `pnpm typecheck`                                                                                              | Passed      | Four packages, strict.                                                                                 |
| `pnpm test`                                                                                                   | Passed      | 5 tests (shared 2, database 3).                                                                        |
| `pnpm test:api`                                                                                               | Passed      | 13 tests — `env.test.ts` (6), `health.routes.test.ts` (2), `change-requests.integration.test.ts` (5).  |
| `pnpm test:web`                                                                                               | Passed      | 6 tests.                                                                                               |
| `pnpm build`                                                                                                  | Passed      | All packages.                                                                                          |
| `pnpm test:e2e`                                                                                               | Passed      | 1 Playwright test against the real stack, now with forced fresh servers.                               |
| `pnpm --filter @appsolo/database generate`                                                                    | Passed      | `No schema changes, nothing to migrate`.                                                               |
| `node scripts/check-scaffolding.mjs`, `generate-phase-index.mjs --check`, `git diff --check 9693281..29fdf5e` | Passed      | Clean.                                                                                                 |
| `pnpm docker:up`                                                                                              | **Not run** | `docker: command not found` — rechecked this pass. AC2 still has no execution evidence from any agent. |
| Probe: API database resolution with `apps/api/.env` present, three precedence cases                           | Passed      | R12 confirmed — see below.                                                                             |
| Probe: live `503` health through the assembled app with an unreachable database                               | Passed      | Envelope, redaction, and correlation intact after the health-route rework.                             |

Codex's recorded counts (5 / 13 / 6) match exactly what I observed.

## Accepted-Fix Verification

| Finding | Severity | Status             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R11     | Low      | **Verified fixed** | `AppDependencies` is a single `{ db, config }` shape again and `createApp` always mounts the real authentication middleware and change-request router ([app.ts:17-20,47-55](apps/api/src/app.ts#L17-L20)). `grep -rn "testOnly\|changeRequestTestRouter\|as never"` across `apps/`, `packages/`, and `e2e/` returns nothing, so neither the test-only branch nor the original unsafe cast survives. `HealthDatabase` now lives with the health route, and the `checkDatabase` injection hole is gone entirely — the route always executes `db.execute('select 1')`. |
| R12     | High     | **Verified fixed** | See detail below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### R11 — verified fixed, and the test fidelity improved

The fix went further than my recommendation in a way worth recording: the malformed-body and oversized-body cases moved out of the stubbed app and into the database-backed integration suite ([change-requests.integration.test.ts:98-110](apps/api/src/modules/change-requests/change-requests.integration.test.ts#L98-L110)), so they now exercise the fully assembled application — real middleware chain, real router, real database — instead of an empty router. Health success and failure are covered directly in the new [health.routes.test.ts](apps/api/src/modules/health/health.routes.test.ts) against a two-line `HealthDatabase` stub.

I confirmed the assembled `503` path still behaves correctly after the rework, since no test exercises it end to end (see R13). Against an unreachable database:

```
HTTP/1.1 503 Service Unavailable
{"error":{"code":"DATABASE_UNAVAILABLE","message":"The service is temporarily unavailable.",
          "details":[],"requestId":"bf2bd9f2-…"}}
log msg='database readiness check failed'  requestId='bf2bd9f2-…'  leaks database name: False
log msg='request errored'                  requestId='bf2bd9f2-…'  leaks database name: False
```

### R12 — verified fixed

[config/env.ts:12-30](apps/api/src/config/env.ts#L12-L30) replaces the two `loadEnv` calls with `loadApiEnvironment`, which parses each file into a private object via dotenv's `processEnv` option and then copies in only the keys the environment does not already define, root file first. Exported values therefore win, and root `.env` wins over duplicate `apps/api/.env` keys — the precedence now documented in both `README.md` and `markdown/contracts/ENVIRONMENT.md`. A regression test writes conflicting fixture files to a temp directory and asserts the exported values survive ([env.test.ts:37-56](apps/api/src/config/env.test.ts#L37)).

I re-ran the exact scenario that produced the finding, with `apps/api/.env` copied from the example as the README instructs:

```
A  apps/api/.env present + APPSOLO_USE_TEST_DATABASE=true exported (Playwright's case)
   config.APPSOLO_USE_TEST_DATABASE = true
   database served = …/appsolo_client_hub_test        (was: …/appsolo_client_hub_dev)

B  apps/api/.env present, nothing exported (normal development)
   config.APPSOLO_USE_TEST_DATABASE = false
   database served = …/appsolo_client_hub_dev          (unchanged, correct)

C  PORT=4999 exported against files declaring 4001 and 4002
   PORT = 4999                                          (exported value wins)
```

The probe file was created for the test and deleted afterwards. `e2e/playwright.config.ts` additionally sets `reuseExistingServer: false` on both servers, closing the related path where an already-running development API could serve the smoke test, and the README documents that the ports must be free.

## New Findings

### R13 — The assembled application's `503` health path has no automated coverage

- Severity: Low
- Requirement or invariant: `markdown/TESTING.md` required case "health endpoint reports unavailability safely when the database check fails"; AC7.
- Evidence: [health.routes.test.ts:10-29](apps/api/src/modules/health/health.routes.test.ts#L10-L29) builds its own express instance with a locally-defined error handler rather than using `createApp`, so the `503` assertion does not exercise the application's real error middleware. The integration suite covers `/health` only on the success path ([change-requests.integration.test.ts:33](apps/api/src/modules/change-requests/change-requests.integration.test.ts#L33)). This is a consequence of removing the `checkDatabase` injection point, which is otherwise a good simplification.
- Impact: A future change to the shared error middleware — for example adding a branch above the `AppError` case — could alter the real `503` envelope while both health tests still pass. Risk is low: I verified the assembled behavior manually this pass and the envelope was correct, redacted, and correlated.
- Recommended correction: Add one integration case that constructs the app with a database pool pointed at an unreachable database (or a `Database`-shaped stub whose `execute` rejects) and asserts `503`, the `DATABASE_UNAVAILABLE` code, and the absence of driver text. Alternatively record that the hand-assembled coverage is accepted.

## Regression And Scope Checks

- No new dependency. Source changes stay inside the phase's own files.
- `grep -riE "aws|@aws-sdk|cognito|s3"` across `apps/`, `packages/`, and `e2e/` still returns nothing. NG1-NG10 hold; the branch is unpushed and `origin/main` is still the base SHA.
- Migrations untouched; `db:generate` reports nothing pending, so R1 stays closed.
- C1's isolation boundary re-verified: `test:prepare` and the integration suite resolve only through `resolvedTestDatabaseUrl`, and with R12 fixed the Playwright API process now also lands on `appsolo_client_hub_test` under the documented configuration. All three routes into the test databases are now consistent.
- R8 re-checked by test: `NewChangeRequest.test.tsx` still renders the create route with a bare `QueryClient` and passes.
- Live probe confirmed no request body, credential, or connection string in API log output, including the database-failure path.

## Cumulative Finding Status

| Pass                     | Findings                                                   | Status             |
| ------------------------ | ---------------------------------------------------------- | ------------------ |
| Initial review           | C1 (Blocker), C2-C3 (High), C4-C10 (Medium), C11-C15 (Low) | All verified fixed |
| Focused re-review        | R1, R7 (Medium), R2-R6 (Low)                               | All verified fixed |
| Second focused re-review | R8 (High), R9-R10 (Low)                                    | All verified fixed |
| Third focused re-review  | R12 (High), R11 (Low)                                      | All verified fixed |
| This pass                | R13 (Low)                                                  | Open, non-blocking |

No Blocker or High finding remains open. Every earlier fix was re-checked this pass and none regressed.

## Human QA Status

`notes/P001/qa.md` still records every case as `Not run`, with `Required QA complete: No`. Claude cannot perform or substitute for human QA, and this review does not discharge it. The following remain outstanding and are the gating items for `complete`:

- **Q1 and Q8 are the only evidence path for AC2.** Docker Compose has been unavailable to Codex and to all four of my passes (`docker: command not found`), so the Compose service, its health check, and the `docker/init-test-db.sql` creation of `appsolo_client_hub_test` have never been executed by anyone. AC2 is unproven, not passed.
- **Q6 deserves particular attention**, because the database-failure path is the one behavior I verified only by manual probe rather than by an automated test through the assembled app (R13).
- **Q5** should exercise both seeded denial identities now documented in the README — `…000005` (Acme Demo Co. member) and `…000006` (internal-only) — since they prove two different authorization rules.
- **Q7** (keyboard and narrow viewport) has no automated proxy at all; nothing in the suite covers it.
- Q2, Q3, and Q4 have automated analogues that pass, but human confirmation is still required by the phase record.

## Verdict (fourth focused re-review — superseded by the fifth focused re-review below)

`ready with non-blocking observations`

Both accepted findings are verified fixed by direct reproduction. R12 in particular is closed at the root: environment files now fill only unset values, so exported variables win, and the scenario that previously routed the browser smoke at the development database now correctly resolves to `appsolo_client_hub_test` with `apps/api/.env` present exactly as the README instructs. A regression test pins the precedence, and forced fresh Playwright servers close the adjacent reuse path. R11's rework also improved test fidelity rather than merely reverting.

Across five passes, one Blocker, three High, nine Medium, and eleven Low findings have been raised and every one is now verified fixed. The implementation matches the phase contracts: tenant authorization is enforced in a single scoped query and proven against two real client tenants plus an internal-only user, the create transaction and status history behave as specified, error envelopes and redaction hold under adversarial probing, migrations are additive with a consistent snapshot chain, and no AWS or out-of-scope work entered the phase.

Two things stand between this and `complete`, and neither is mine to close:

1. **AC2 has no execution evidence.** Docker was unavailable in every environment available to Codex and to me. The Compose path must be exercised by human QA Q1/Q8 before the completion gate can be satisfied.
2. **All eight human QA cases remain unrun.** `notes/P001/qa.md` records `Not run` for Q1-Q8.

R13 is a Low observation about test coverage of the assembled `503` path and needs only a disposition.

---

# Fifth Focused Re-Review — Accepted Fourth Re-Review Finding

## Re-Review Target

- Third re-review-fix SHA: `29fdf5e`
- Fourth re-review-fix SHA: `5885db4` (exists, `P001: cover assembled health failure`)
- Reviewed range: `git diff 29fdf5e..5885db4` — the only source change is a new case in `apps/api/src/modules/change-requests/change-requests.integration.test.ts`; everything else is control-plane evidence.
- Working tree at re-review time: clean at `57b3484` (`P001: record fourth re-review fix handoff`). `5885db4..57b3484` touches only the P001 phase record and `notes/P001/*`.
- Disposition source: `notes/P001/review-disposition.md` — R13 `Accepted`.

## Validation Rerun

| Command                                                                                                       | Result      | Notes                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `git cat-file -t 5885db4`                                                                                     | Passed      | Fix SHA exists.                                                                                       |
| `pnpm lint`                                                                                                   | Passed      | ESLint + `prettier --check .`.                                                                        |
| `pnpm typecheck`                                                                                              | Passed      | Four packages, strict.                                                                                |
| `pnpm test`                                                                                                   | Passed      | 5 tests (shared 2, database 3).                                                                       |
| `pnpm test:api`                                                                                               | Passed      | 14 tests — `env.test.ts` (6), `health.routes.test.ts` (2), `change-requests.integration.test.ts` (6). |
| `pnpm test:web`                                                                                               | Passed      | 6 tests.                                                                                              |
| `pnpm build`                                                                                                  | Passed      | All packages.                                                                                         |
| `pnpm test:e2e`                                                                                               | Passed      | 1 Playwright test against the real stack.                                                             |
| `pnpm --filter @appsolo/database generate`                                                                    | Passed      | `No schema changes, nothing to migrate`.                                                              |
| `node scripts/check-scaffolding.mjs`, `generate-phase-index.mjs --check`, `git diff --check 29fdf5e..5885db4` | Passed      | Clean.                                                                                                |
| `pnpm docker:up`                                                                                              | **Not run** | `docker: command not found` — rechecked again this pass.                                              |

Codex's recorded counts (5 / 14 / 6) match exactly what I observed.

## Accepted-Fix Verification

| Finding | Severity | Status             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | -------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R13     | Low      | **Verified fixed** | [change-requests.integration.test.ts:41-65](apps/api/src/modules/change-requests/change-requests.integration.test.ts#L41-L65) now builds the ordinary application through `createApp({ db, config })` with a real Drizzle/`pg` client pointed at `127.0.0.1:1`, then asserts `503`, the exact `DATABASE_UNAVAILABLE` code and safe message, that `error.requestId` equals the `x-request-id` response header, and that neither `ECONNREFUSED` nor the address appears in the body. The pool is closed in a `finally`. This is the assembled middleware chain, not a hand-built app, so the gap the finding named is closed. |

The assertions are substantive rather than incidental — status, code, message, correlation, and two distinct redaction checks — so a regression in the shared error middleware or in the health route would fail this test rather than pass silently. The unreachable endpoint is a privileged local port, so the case is deterministic and needs no network access, satisfying `markdown/TESTING.md`'s rule that tests must not depend on external services.

## Regression And Scope Checks

- No production source changed in this commit; no new dependency.
- `grep -riE "aws|@aws-sdk|cognito"` across `apps/`, `packages/`, and `e2e/` returns nothing. NG1-NG10 hold; the branch is unpushed and `origin/main` is still the base SHA.
- Migrations untouched; `db:generate` reports nothing pending.
- R11 and R12 re-checked and still closed: `createApp` retains one dependency shape, and the environment-precedence regression test still passes.
- C1's isolation boundary re-verified: `test:prepare`, the API integration suite, and the Playwright API process all resolve only to `appsolo_client_hub_test`.

## Cumulative Finding Status

| Pass                     | Findings                                                   | Status             |
| ------------------------ | ---------------------------------------------------------- | ------------------ |
| Initial review           | C1 (Blocker), C2-C3 (High), C4-C10 (Medium), C11-C15 (Low) | All verified fixed |
| Focused re-review        | R1, R7 (Medium), R2-R6 (Low)                               | All verified fixed |
| Second focused re-review | R8 (High), R9-R10 (Low)                                    | All verified fixed |
| Third focused re-review  | R12 (High), R11 (Low)                                      | All verified fixed |
| Fourth focused re-review | R13 (Low)                                                  | Verified fixed     |
| This pass                | none                                                       | —                  |

**No finding of any severity remains open.** Every accepted correction has been verified by independent reproduction, and no earlier fix regressed under re-check.

## Remaining Gates — Not Claude's To Close

### AC2 has no execution evidence from any agent

`pnpm docker:up` has never been run. Docker Compose was unavailable to Codex during implementation and to all five of my review passes (`docker: command not found`). The Compose service definition, its `pg_isready` health check, the named volume, and `docker/init-test-db.sql`'s creation of `appsolo_client_hub_test` have been reviewed by reading only. Per this repository's review contract, that is missing evidence, not a pass. AC2 can only be closed by human QA on a machine with Docker.

### Human QA Q1-Q8 remain unrun

`notes/P001/qa.md` still records `Not run` for every case and `Required QA complete: No`. Points worth carrying into that session:

- **Q1 and Q8** are the only path to AC2. Q8 should also confirm the documented volume/reset behavior, since `docker/init-test-db.sql` runs only on first volume initialization — a pre-existing volume will not contain `appsolo_client_hub_test`, which the README troubleshooting section already warns about.
- **Q5** should exercise both denial identities: `20000000-…-000000000005` (member of the second client tenant, Acme Demo Co.) and `20000000-…-000000000006` (internal-only). They prove two different authorization rules — cross-tenant membership scoping and the ADR-0003 rule that internal membership alone grants nothing.
- **Q6** now has automated coverage through the assembled app (R13), but the _browser-side_ retry state has none; confirm the UI shows the retryable error rather than a blank or stuck view.
- **Q7** (keyboard navigation, focus order, narrow viewport) has no automated proxy anywhere in the suite.
- **Q3** should include a browser refresh directly on the create form and on a detail page, since those deep-link paths were the subject of R8.

## Verdict

`ready with non-blocking observations`

The code is ready for human QA. Across six passes I raised one Blocker, three High, nine Medium, and twelve Low findings; all are now verified fixed by independent reproduction rather than by accepting the handoff's account, and re-checks in each pass confirmed no earlier fix regressed.

The implementation matches the phase contracts on every point I was able to execute: tenant authorization is enforced by a single scoped query and proven against two real client tenants plus an internal-only user across list, detail, and create; creation and its initial status history commit in one transaction; error envelopes, status codes, redaction, and request correlation hold under adversarial probing; the schema and its additive migrations match `DATA_MODEL.md` with a consistent snapshot chain; development authentication cannot start in production; test and development databases are isolated under every configuration I could construct; and no AWS, production-auth, or other out-of-scope work entered the phase.

The observations are the two gates that remain, neither of which a reviewer can discharge:

1. **AC2 is unproven.** No agent has executed `pnpm docker:up`. It must be verified by human QA.
2. **Human QA Q1-Q8 has not started.**

P001 should not be marked `complete` until both are satisfied and recorded in `notes/P001/qa.md`.
