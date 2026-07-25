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

## Verdict

`changes requested`

C1 is a Blocker: following the repository's own README destroys the developer's database on the next test run, and the guard reports success while doing it. C2 and C3 are High: the documented startup path fails from a clean checkout, and several contract-required authorization and route tests are absent, so the phase's central tenant-safety claim is under-evidenced. AC2 additionally has no execution evidence from either agent and must be treated as missing until human QA covers Q1/Q8.

The underlying implementation is otherwise sound — the schema is a faithful rendering of the contract, the authorization query is correct, the transaction and error envelope behave as specified, and every command I reran passed. The blocking issues are configuration and coverage defects, not design defects.
