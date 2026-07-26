# Claude Review — P003 Estimates And Approval Workflow

> Status: Complete. Independent review executed on 2026-07-26.

## Review Target

- Base SHA: `274a9897c9fc8c681b4d1eac13ca8b16c0107a62` (exists, commit)
- Candidate SHA: `9c9ab03899a5295cbcd54a3f22279c1280b5911f` (exists, commit)
- Exact range:
  `git diff 274a9897c9fc8c681b4d1eac13ca8b16c0107a62..9c9ab03899a5295cbcd54a3f22279c1280b5911f`
- Diff size: 30 files, +4324/-48.

### Boundary Integrity

- Working tree clean at review time (`git status --short` empty), so no
  uncommitted code changes the reviewed result.
- `git diff 9c9ab03..HEAD` touches only `markdown/` and `notes/` (the handoff
  commit `e41fbca`). No `apps/`, `packages/`, or `e2e/` file differs between the
  candidate SHA and the working tree.
- `git diff --check <base>..<candidate>`: clean.
- No `package.json` or `pnpm-lock.yaml` change in the range — the phase added no
  dependency, consistent with the "no decimal library" implementation choice.
- Non-goal search over the diff (`aws-sdk`, `@aws`, `cognito`, `nodemailer`,
  `stripe`, `invoice`, `payment`, `bullmq`) returns documentation prose only.

## Independent Validation Rerun

Claude reran the following against the local Docker PostgreSQL service
(`appsolo-hub-postgres-1`, healthy) and the isolated `appsolo_client_hub_test`
database. The development database was not modified.

| ID  | Command                                         | Result | Evidence                                                                     |
| --- | ----------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| C1  | `node scripts/check-scaffolding.mjs`            | Passed | 27 required files, 11 phase records.                                         |
| C2  | `pnpm typecheck`                                | Passed | Strict shared, database, API, and web checks.                                |
| C3  | `pnpm lint`                                     | Passed | ESLint clean; Prettier clean.                                                |
| C4  | `pnpm --filter @appsolo/database test:prepare`  | Passed | Test-only reset, migrations applied, seed present.                           |
| C5  | `pnpm test`                                     | Passed | 15 shared + 4 database tests.                                                |
| C6  | `pnpm test:api`                                 | Passed | 31 tests in 5 files against PostgreSQL.                                      |
| C7  | `pnpm test:web`                                 | Passed | 19 tests in 7 files (4 P003 component tests).                                |
| C8  | `pnpm build`                                    | Passed | shared, database, api, and web builds.                                       |
| C9  | `pnpm test:e2e`                                 | Passed | 3 real Playwright flows, 7.0s, including the P003 draft/submit/approve flow. |
| C10 | `pnpm --filter @appsolo/database generate`      | Passed | `No schema changes, nothing to migrate` — no drift after `0004`.             |
| C11 | `pnpm db:seed` twice (test URL)                 | Passed | Stable counts: 7 estimates, 3 responses, 9 history rows, 7 change requests.  |
| C12 | `node scripts/generate-phase-index.mjs --check` | Passed | Index current.                                                               |
| C13 | `node scripts/validate-phase.mjs P003`          | Passed | Phase structure valid.                                                       |
| C14 | Direct API probes against the test database     | Passed | See "Independent Probes" below.                                              |
| C15 | Direct SQL invariant probes                     | Mixed  | Cost invariant enforced; response-reason invariant is a no-op (P003-F1).     |

Codex's recorded V1-V20 results are consistent with what Claude reproduced. The
handoff's disclosure that the first V10 run used a bad fixture (an intentionally
examined overflow case) and was corrected is honest and does not overstate the
result.

### Independent Probes

Run against a throwaway API process bound to `appsolo_client_hub_test`
(`NODE_ENV=development`, port 4099); the test database was reset afterwards.

| Probe                                                    | Expected | Actual                                            |
| -------------------------------------------------------- | -------- | ------------------------------------------------- |
| `CLIENT_MEMBER` POST create draft                        | 403      | `403 FORBIDDEN`, no resource data                 |
| Manager POST create draft on `APPROVED` request          | 409      | `409 CONFLICT`                                    |
| Manager POST create draft on `AWAITING_APPROVAL` request | 409      | `409 CONFLICT`                                    |
| Owner PATCH other-tenant estimate                        | 404      | `404 NOT_FOUND`, no identifier echoed             |
| Owner PATCH unknown estimate id                          | 404      | `404 NOT_FOUND` (identical to cross-tenant)       |
| `CLIENT_MEMBER` POST respond                             | 404      | `404 NOT_FOUND` (no capability oracle)            |
| `CLIENT_ADMIN` respond to an already-`APPROVED` estimate | 409      | `409 CONFLICT`                                    |
| Unknown key `actorUserId` on the respond body            | 400      | `400 VALIDATION_ERROR`, `Unrecognized key(s)`     |
| `estimatedHours: "2.005"` / `hourlyRate: "150.005"`      | 400      | `400`, field-specific decimal message             |
| Overflow `999999.99 × 9999999999.99`                     | 400      | `400`, `The calculated cost is too large.`        |
| Exact rounding `2.50 × 150.01`                           | `375.03` | `375.03` (exact half-up at scale 4)               |
| Repeated submit with the same `expectedUpdatedAt`        | 200, 409 | `200` then `409 CONFLICT`                         |
| Real `REJECT` decision                                   | atomic   | estimate+request `REJECTED`, one history row      |
| Real `REQUEST_CLARIFICATION` decision                    | atomic   | both `NEEDS_CLARIFICATION`, one history row       |
| Revision submit after clarification                      | atomic   | v1 `SUPERSEDED` with its original response intact |

Structured logs observed during `pnpm test:api` show `x-dev-user-id` rendered as
`[Redacted]` and no request body at any level; `req.body` and `DATABASE_URL`
remain in the pino redact list
([app.ts:44-50](apps/api/src/app.ts#L44-L50)). No estimate scope note, response
note, hours, rate, or cost value appeared in any log line.

## Requirement And Acceptance Assessment

| Item            | Verdict               | Primary evidence                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 / AC1-AC2    | Met                   | [policy.ts:17-24](apps/api/src/modules/access/policy.ts#L17-L24) gives `OWNER`/`ADMIN`/`DEVELOPER` `MANAGE_ESTIMATES` and `CLIENT_ADMIN` `RESPOND_TO_ESTIMATES` exclusively; every repository query re-joins active project, active `CLIENT` organization, and active membership. Probes confirm denial for other-tenant, internal-only, suspended, and wrong-role actors. |
| R2 / AC3-AC4    | Met                   | [index.ts](packages/shared/src/index.ts) `normalizeFixedScaleDecimal` and `calculateEstimatedCost` use `BigInt` hundredths and half-up at scale 4; `MAX_COST_CENTS` is exactly the `numeric(12,2)` ceiling. No `number` appears on the value path. `estimates_cost_matches_terms` uses `round(hours*rate, 2)`, identical to half-up for the enforced non-negative domain.  |
| R3 / AC5-AC7    | Met                   | [repository.ts:148-201](apps/api/src/modules/estimates/repository.ts#L148-L201) locks the change request `FOR UPDATE`, allocates `max(version)+1`, and conditionally writes the `SUBMITTED → AWAITING_ESTIMATE` transition plus one history row. Draft rows are excluded in SQL for non-managers, not hidden in React.                                                     |
| R4 / AC8-AC10   | Met                   | [repository.ts:259-346](apps/api/src/modules/estimates/repository.ts#L259-L346) locks request and estimate, verifies `expectedUpdatedAt` and lifecycle, supersedes only `version - 1` when it is `REJECTED`/`NEEDS_CLARIFICATION`, and writes state plus history atomically.                                                                                               |
| R5 / AC11-AC15  | Met                   | [repository.ts:348-446](apps/api/src/modules/estimates/repository.ts#L348-L446) uses a conditional `SUBMITTED →` update plus `estimate_responses_estimate_unique`. Concurrent duplicate approval yields exactly `[200, 409]` and one durable row. Approval maps the request to `APPROVED`, never `IN_PROGRESS`.                                                            |
| R6 / AC16-AC17  | Met                   | Explicit `asDto` mapping ([service.ts:26-48](apps/api/src/modules/estimates/service.ts#L26-L48)); ordering `version desc, id desc`; superseded terms and their original response remain readable (verified live). Inaccessible and non-existent identifiers are indistinguishable.                                                                                         |
| R7 / AC18       | Met                   | Strict path/query/body schemas in [estimate.routes.ts](apps/api/src/modules/estimates/estimate.routes.ts); `emptyQuerySchema` rejects `?includeDraft=true`; server-owned `estimatedCost`/`status`/`version` are rejected by `.strict()`. Standard envelopes and `requestId` on every observed response.                                                                    |
| R8 / AC19-AC21  | Met with observations | [EstimateSection.tsx](apps/web/src/features/estimates/EstimateSection.tsx) delivers role-aware create/edit/submit/respond, read-only derived cost, distinguishable history states, and a `max-width: 760px` single-column layout. See P003-F2, P003-F3, P003-F6.                                                                                                           |
| R9 / AC22-AC23  | Met with observation  | Additive `0004_sloppy_bloodaxe.sql` (no drop, no rewrite), backfilled `version` default `1`, drift-free snapshot, twice-idempotent seed with deterministic lifecycle and cross-tenant fixtures. See P003-F1.                                                                                                                                                               |
| R10 / AC24-AC25 | Met with observation  | P001/P002 regressions pass with behavior unchanged (only the seeded list expectation grew). See P003-F4.                                                                                                                                                                                                                                                                   |

Product and architecture invariants hold: money never passes through floating
point, `AuthenticatedUser` remains provider-neutral, business modules never read
`x-dev-user-id`, the production development-auth guard at
[env.ts:65-66](apps/api/src/config/env.ts#L65-L66) is untouched, no AWS coupling
entered, and no speculative framework or base class was introduced.

## Findings

### P003-F1 — Database reason-required check is a no-op for a NULL note (Medium)

- **Affects:** R5, R9/AC22, and the `DATA_MODEL.md` claim that database checks
  "require a 3-character reason for rejection or clarification".
- **Evidence:** [schema.ts](packages/database/src/schema.ts) and
  [0004_sloppy_bloodaxe.sql:12](packages/database/drizzle/0004_sloppy_bloodaxe.sql#L12)
  define
  `CHECK (decision = 'APPROVED' or char_length(btrim(note)) between 3 and 2000)`.
- **Reasoning:** for `decision <> 'APPROVED'` with `note IS NULL`, the right
  operand evaluates to `NULL`, so the expression is `false OR NULL = NULL`.
  PostgreSQL treats a `NULL` check result as satisfied, so the row is accepted.
- **Reproduction (executed against `appsolo_client_hub_test`):**

  ```sql
  INSERT INTO estimate_responses (estimate_id, decision, responding_user_id, note)
  VALUES ('50000000-0000-4000-8000-000000000002','REJECTED',
          '20000000-0000-4000-8000-000000000003', NULL);
  -- INSERT 0 1   (expected: 23514 check violation)
  ```

- **Impact:** technical only in P003. The Zod discriminated union in
  [index.ts](packages/shared/src/index.ts) and the single write path make the
  application layer the real enforcement, and no route can reach the database
  with a null reason today. The risk is that the documented database backstop
  does not exist, so a future writer, migration, or repair script can create a
  reasonless rejection that the immutable-history contract implies is
  impossible. The sibling `estimate_responses_note_length` check is correct
  because it explicitly handles `is null`.
- **Recommendation:** change the predicate to
  `decision = 'APPROVED' or (note is not null and char_length(btrim(note)) between 3 and 2000)`
  in an additive follow-up migration, or soften the `DATA_MODEL.md` claim to
  describe application-layer enforcement only.

### P003-F2 — Stale-conflict message claims a reload that does not reach the form (Medium)

- **Affects:** R8, AC6, and human QA Q3.
- **Evidence:**
  [EstimateSection.tsx:69-79](apps/web/src/features/estimates/EstimateSection.tsx#L69-L79)
  seeds the term inputs from the server draft in an effect keyed on
  `[draft?.id]`;
  [EstimateSection.tsx:39-44](apps/web/src/features/estimates/EstimateSection.tsx#L39-L44)
  renders the 409 text "This estimate changed or is no longer actionable. The
  latest state has been loaded."
- **Reproduction:** open the same draft in two browsers. Save in browser A. In
  browser B change hours and save. B receives `409`, `refresh()` refetches, and
  the history card below updates to A's terms — but `draft.id` is unchanged, so
  the effect does not re-run and the three inputs still hold B's stale values.
  Clicking **Save draft** again sends B's stale terms with the refreshed
  `expectedUpdatedAt` and succeeds, silently overwriting A's newer terms.
- **Impact:** the API contract is intact — the first stale write is rejected and
  nothing is lost without a second deliberate click. The defect is that the
  message asserts a state that was not applied, and the recovery path quietly
  converts a rejected conflict into an accepted overwrite on the next click.
- **Recommendation:** on a 409, re-seed the form from the refetched draft (or key
  the effect on `draft?.updatedAt`), and change the copy to state what actually
  happened, for example "Another manager changed this draft. The latest terms are
  shown — review them before saving."

### P003-F3 — Mutation failures are announced through the success notice (Medium)

- **Affects:** R8/AC20 and the `REVIEW_CHECKLIST.md` frontend error-state item.
- **Evidence:**
  [EstimateSection.tsx:104-116](apps/web/src/features/estimates/EstimateSection.tsx#L104-L116)
  routes both the success string and `errorText(error)` into the same `feedback`
  state, rendered at
  [EstimateSection.tsx:185-189](apps/web/src/features/estimates/EstimateSection.tsx#L185-L189)
  as `<p className="notice" role="status">`. The global `.notice` rule is green
  success styling (`color: #067647; background: #ecfdf3`) in
  [apps/web/src/styles/](apps/web/src/styles/), while `.error` with
  `role="alert"` exists and is used correctly elsewhere — for example
  [NewChangeRequest.tsx:52](apps/web/src/features/change-requests/NewChangeRequest.tsx#L52)
  and the response-note error in this same component.
- **Reproduction:** as a client administrator, approve an estimate that another
  administrator just approved. The `409` message renders in the green success box
  and is announced politely rather than assertively.
- **Impact:** a client administrator whose approval, rejection, or clarification
  failed sees the same visual affordance as a success. In an approval workflow
  whose value proposition is unambiguous decisions, a missed failure is a real
  support and dispute risk.
- **Recommendation:** track success and failure separately and render failures
  with `className="error"` and `role="alert"`, matching the P001/P002 pattern.

### P003-F4 — Rejection and clarification decisions are never exercised through the API in tests (Medium)

- **Affects:** AC12, AC13, AC2, AC24, and prompt V11 ("all decisions").
- **Evidence:**
  [estimates.integration.test.ts:242-281](apps/api/src/modules/estimates/estimates.integration.test.ts#L242-L281)
  is the only test naming `REJECT`, and it asserts only the `400` for a
  whitespace reason; `REQUEST_CLARIFICATION` never reaches the API in any
  integration test. Supersession is proven from the static seed fixture rather
  than from a decision the test itself caused. `CLIENT_MEMBER` create, edit, and
  submit denial — named explicitly in AC2 — is also untested; only `CLIENT_ADMIN`
  create (`403`) and `DEVELOPER` respond (`404`) are covered.
- **Impact:** test coverage only. Claude executed both decisions live and
  confirmed they are correct: `REJECT` moved estimate and request to `REJECTED`
  with exactly one `AWAITING_APPROVAL → REJECTED` history row, and
  `REQUEST_CLARIFICATION` moved both to `NEEDS_CLARIFICATION` with one history
  row. `CLIENT_MEMBER` create returns `403`. This is a regression-protection gap,
  not a behavioral defect — two of the three binding decision transitions and one
  named denial case would not fail a test if they broke.
- **Recommendation:** add integration cases that perform a real `REJECT` and a
  real `REQUEST_CLARIFICATION`, asserting estimate status, request status, the
  single response row, and the single history row; add `CLIENT_MEMBER`
  create/edit/submit denial assertions.

### P003-F5 — Response DTO is dropped when a responder name component is empty (Low)

- **Affects:** R6.
- **Evidence:**
  [service.ts:39-47](apps/api/src/modules/estimates/service.ts#L39-L47) gates the
  response object on
  `row.responseDecision && row.responseCreatedAt && row.responseFirstName && row.responseLastName`.
- **Impact:** the joined columns are nullable only because of the `LEFT JOIN`,
  but the guard tests truthiness rather than nullness. A user row with an
  empty-string `first_name` or `last_name` would silently erase the entire
  decision record from history while the estimate still displays `REJECTED`.
  `users` has no non-empty check, so this is reachable through direct data entry.
- **Recommendation:** gate on `row.responseDecision !== null` (or
  `responseCreatedAt !== null`) and let `displayName` handle blank components.

### P003-F6 — Term validation errors are not programmatically associated with their inputs (Low)

- **Affects:** R8's accessibility clause and the `REVIEW_CHECKLIST.md` "error
  association" item.
- **Evidence:**
  [EstimateSection.tsx:207-243](apps/web/src/features/estimates/EstimateSection.tsx#L207-L243)
  renders `<span className="error">` inside the wrapping `<label>` with
  `aria-invalid` but no `aria-describedby` and no `role="alert"`. Because the
  span sits inside the label, the message folds into the input's accessible name
  rather than being exposed as a description, so the field announces as
  "Estimated hours Use a plain decimal string…". The decision-note field in the
  same component does this correctly with `aria-describedby` and `role="alert"`.
- **Impact:** minor. The message is still reachable by a screen reader on focus,
  and keyboard operation, focus movement to the feedback paragraph, heading
  order, and the narrow-viewport layout are all sound.
- **Recommendation:** move the error text outside the `<label>`, give it an id,
  and reference it from the input with `aria-describedby`.

### P003-F7 — Cost-overflow validation is reported against `hourlyRate` (Low)

- **Affects:** R7's "field-specific" validation clause.
- **Evidence:** [service.ts:76-87](apps/api/src/modules/estimates/service.ts#L76-L87)
  always attaches the calculation failure to `path: 'hourlyRate'`.
- **Impact:** cosmetic. The message ("The calculated cost is too large.") is
  clear, but it is anchored to one of the two contributing fields regardless of
  which one the user should reduce.
- **Recommendation:** report the overflow at form level (`path: 'request'` or a
  dedicated `estimatedCost` path) so neither input is falsely blamed.

## Items Explicitly Challenged And Cleared

- **Draft-existence oracle.** Every client-role path was probed: the list route
  filters `DRAFT` in SQL and reports `count: 0`; `POST` create returns `403`
  before touching draft state; `PATCH`, `submit`, and `respond` on a draft
  identifier return the same `404` as a non-existent identifier. No response,
  count, or status code distinguishes "draft exists" from "no draft".
- **Cross-tenant and internal-only access.** `otherTenantUser`,
  `internalOnlyUser`, and `suspendedMember` receive `404` with no `data` property
  and no identifier echo. Every estimate query re-joins active membership,
  `projects.status = 'ACTIVE'`, `organizations.status = 'ACTIVE'`, and
  `organizations.type = 'CLIENT'` in the same statement, so internal membership
  alone grants nothing.
- **Decimal parity between JavaScript and PostgreSQL.** The `BigInt` path rounds
  half-up on an exact scale-4 product; `round(numeric, 2)` rounds half away from
  zero, which is identical over the non-negative domain enforced by
  `estimates_hours_positive` and `estimates_rate_nonnegative`. `MAX_COST_CENTS`
  (`999999999999`) is exactly the `numeric(12,2)` ceiling. The stored-cost check
  was independently confirmed to fire (`23514`) on a tampered cost.
- **Lock ordering and deadlock risk.** Both mutation paths acquire
  `change_requests` and `estimates` in one statement (`FOR UPDATE OF ...`), and
  the supersession lock that follows targets a lower version of the same request,
  so ordering is deterministic per change request.
- **Version monotonicity under concurrency.** `max(version) + 1` is computed
  under the request row lock, with `estimates_request_version_unique` and the
  partial draft index as backstops; the `23505 → 409` mapping walks
  `error.cause`, so Drizzle's wrapper does not hide the code.
- **Approved finality and no replacement while awaiting a response.** Draft
  creation on an `APPROVED` or `AWAITING_APPROVAL` request returns `409`
  (probed), and submission requires the previous version to be exactly
  `version - 1` in `REJECTED` or `NEEDS_CLARIFICATION`.
- **Migration safety.** `0004` contains no `DROP`, no column type change, and no
  data rewrite; `version integer DEFAULT 1 NOT NULL` backfills the existing
  seeded estimate; the added enum value is not consumed within the same
  migration, so it is safe on the PostgreSQL 16 image in use. `generate` reports
  no drift.
- **Cache isolation across identities.** `queryClient.clear()` on sign-out and
  sign-in ([SessionProvider.tsx:35](apps/web/src/session/SessionProvider.tsx#L35),
  [:59](apps/web/src/session/SessionProvider.tsx#L59)) is unchanged, and the
  Playwright flow switches identities twice without leaking data.
- **Scope discipline.** No dependency was added; no AWS, Cognito, SES, payment,
  comment, or time-tracking code entered; no unrelated refactor obscures the
  diff. The change-request integration test edit is a seed-count adjustment, not
  a behavior change.

## Fix Verification — Review-Fix Commit `5de9490`

> Verified on 2026-07-26 against
> `git diff 9c9ab03899a5295cbcd54a3f22279c1280b5911f..5de9490cf80c3cdda286f0565608f415ee75241f`.
> All seven findings were dispositioned `Accepted` by the human in
> `notes/P003/review-disposition.md`.

### Fix Boundary

- Working tree clean; `git diff 5de9490..HEAD` (commit `ce3e268`) touches only
  `markdown/` and `notes/`, so no code differs from the review-fix commit.
- The fix diff touches 6 code paths plus one additive migration, its snapshot,
  and documentation. No dependency, route, capability, or lifecycle rule
  changed, and no candidate behavior outside the accepted findings was altered.
- Migration `0005_early_namor.sql` is a single `ADD CONSTRAINT` — additive, no
  drop, no rewrite, no data change. The development database reports 6 applied
  migrations, confirming `0005` was layered onto existing P001/P002/P003 data
  rather than a reset.

### Revalidation After The Fix

| Command                                        | Result | Evidence                                                         |
| ---------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `pnpm typecheck`                               | Passed | Strict checks in all four packages.                              |
| `pnpm lint`                                    | Passed | ESLint and Prettier clean.                                       |
| `pnpm test`                                    | Passed | 15 shared + 5 database tests (was 4; +1 NULL-reason invariant).  |
| `pnpm test:api`                                | Passed | 34 tests in 5 files (was 31; estimates file 8 → 11).             |
| `pnpm test:web`                                | Passed | 20 tests in 7 files (was 19).                                    |
| `pnpm build`                                   | Passed | shared, database, api, and web builds.                           |
| `pnpm test:e2e`                                | Passed | 3 real Playwright flows, 6.3s.                                   |
| `pnpm --filter @appsolo/database generate`     | Passed | `No schema changes, nothing to migrate` — no drift after `0005`. |
| `pnpm --filter @appsolo/database test:prepare` | Passed | Test-only reset applied `0000`–`0005` and reseeded.              |

The handoff's "Accepted Review-Fix Validation" table matches these results, and
its disclosure of three interim failures (a component alert query, a
Markdown-only lint failure on this review file, and an unresolvable workspace
alias in an ad hoc probe) is honest. Claude confirmed the Markdown normalization
was formatting-only: all seven finding headings, severities, evidence, and the
verdict section are unchanged in the committed file.

### Per-Finding Verdicts

| ID  | Severity | Status   | Independent evidence                                                                                                                                                                                                                                                                                           |
| --- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Medium   | Verified | New `estimate_responses_reason_present` check. Direct SQL: `REJECTED` with `note = NULL` → `23514`; `CLARIFICATION_REQUESTED` with `note = '   '` → `23514`; `APPROVED` with `note = NULL` still inserts. Confirmed present in both the test and development databases. A database test now pins the behavior. |
| F2  | Medium   | Verified | The seeding effect is keyed on `[draft?.id, draft?.updatedAt]`, so the refetch after a 409 re-seeds the inputs. The component test now asserts the form holds the server's newer `6.00 / 150.00 / <new scope>` after the conflict and that `update` was called exactly once. Copy no longer overstates.        |
| F3  | Medium   | Verified | Feedback is a `{ kind, message }` union; failures render `className="error"` with `role="alert"`, successes keep `notice`/`status`. The component test asserts both the class and the role on the real component.                                                                                              |
| F4  | Medium   | Verified | Three new integration cases: real `REJECT` and `REQUEST_CLARIFICATION` decisions asserting estimate status, request status, exactly one response row, and exactly one `AWAITING_APPROVAL →` history row each; `CLIENT_MEMBER` create `403` / edit `404` / submit `404` with no identifier echo; and overflow.  |
| F5  | Low      | Verified | Guards are now explicit `!== null`. Probed live with `first_name = ''`: history still returns the full response with `actorDisplayName: "Admin"`. An integration test pins it.                                                                                                                                 |
| F6  | Low      | Verified | Fields are now `div.field` with explicit `htmlFor`/`id`, conditional `aria-describedby`, and `role="alert"` error spans. The new component test asserts the accessible name stays "Estimated hours" while an accessible description exists and its element carries `role="alert"`.                             |
| F7  | Low      | Verified | Overflow now reports `path: "estimatedCost"`. Probed live: `999999.99 × 9999999999.99` → `400` with `estimatedCost` / "The calculated cost is too large."                                                                                                                                                      |

### Regression Recheck After The Fix

Re-probed against the isolated test database: exact strings `4.50 / 125.00 /
562.50` unchanged for a manager; client-member view of the same request still
returns `[]` with `count: 0`, `canManage: false`, `canRespond: false`; the
`23514` stored-cost invariant, cross-tenant `404`, capability matrix, and
concurrency outcomes are unchanged. No finding was fixed by weakening tenant
scope, lifecycle rules, or the exact-decimal contract.

### Residual Observation (no action required)

The superseded `estimate_responses_reason_required` check was left in place
alongside the new `estimate_responses_reason_present` check rather than being
dropped. Keeping it is the correct choice for an additive migration policy — the
old predicate is now strictly weaker than the new one and can never admit a row
the new one rejects. It is redundant, not incorrect; a future consolidation
migration may drop it.

## Verdict

ready

Every accepted finding is verified fixed with independent evidence, all
validation passes at the review-fix commit, and no regression was introduced.
P003 remains gated on human Q1-Q10 QA and integration approval, which are
outside Claude's authority.
