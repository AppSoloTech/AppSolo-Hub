# Claude Review — P002

> Status: Complete. Independent review of the immutable candidate range.

## Review Target

- Base SHA: `d3af5e9b4b3780ac41060fc51888ed8c413a1fe7` (exists, `P002: approve authentication and invitations phase`)
- Candidate SHA: `13cb4de63170b9d5e51d3400e38395b8acc12189` (exists, `P002: implement authentication and invitations`)
- Reviewed range: `git diff d3af5e9b4b3780ac41060fc51888ed8c413a1fe7..13cb4de63170b9d5e51d3400e38395b8acc12189` — 47 files, +5233 / −80
- Prompt: `prompts/active/P002-authentication-and-invitations.md`, `spec_version: 1`, `status: approved`
- Working tree at review time: clean at `2b937c2` (`P002: record implementation handoff`). `13cb4de..2b937c2` touches only `markdown/CURRENT_STATE.md`, `markdown/PHASE_INDEX.md`, the P002 phase record, and `notes/P002/*`. No application source, migration, test, or contract file differs between the candidate and the tree that was executed, so every rerun result below is attributable to the candidate commit.
- No uncommitted work supplied any reviewed behavior.
- `pnpm-lock.yaml` is not in the diff and no runtime dependency was added.

## Validation Rerun

All commands were executed by Claude against the tree described above, with the Compose PostgreSQL container healthy on host port 5433.

| Command                                                | Result | Evidence                                                                                                                      |
| ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `git cat-file -t <base>`, `<candidate>`                | Passed | Both SHAs resolve to commits.                                                                                                 |
| `git diff --check <base>..<candidate>`                 | Passed | No whitespace errors.                                                                                                         |
| `node scripts/check-scaffolding.mjs`                   | Passed | 27 required files, 11 phase records.                                                                                          |
| `node scripts/generate-phase-index.mjs --check`        | Passed | `PHASE_INDEX.md is current.`                                                                                                  |
| `node scripts/validate-phase.mjs P002`                 | Passed | `P002 phase structure is valid.`                                                                                              |
| `pnpm lint`                                            | Passed | Real `eslint .` plus `prettier --check .`, exit 0.                                                                            |
| `pnpm typecheck`                                       | Passed | Strict `tsc` across shared, database, api, web.                                                                               |
| `pnpm test`                                            | Passed | 4 shared + 3 database tests.                                                                                                  |
| `pnpm test:api`                                        | Passed | 21 tests / 4 files against `appsolo_client_hub_test`, including the 7 new access integration cases.                           |
| `pnpm test:web`                                        | Passed | 11 tests / 5 files, including `Session.test.tsx` (3) and `AccessManagement.test.tsx` (2).                                     |
| `pnpm build`                                           | Passed | shared, database, api `tsc`; web Vite production bundle.                                                                      |
| `pnpm test:e2e`                                        | Passed | 2 Playwright tests in real Chromium against live web + API + test PostgreSQL, including the invite/copy/accept flow.          |
| `pnpm --filter @appsolo/database generate`             | Passed | `No schema changes, nothing to migrate` — no drift after the checked-in `0002_regular_magneto.sql` and snapshot.              |
| `pnpm --filter @appsolo/database test:prepare`         | Passed | Guarded reset of `appsolo_client_hub_test` only; migration and seed completed.                                                |
| `pnpm db:seed` twice                                   | Passed | Development database unchanged after both runs: 8 users, 9 memberships, 1 invitation, 1 audit event.                          |
| Dev-database migration inspection                      | Passed | 3 rows in `drizzle.__drizzle_migrations`; `organization_memberships.status` present; all pre-existing P001 rows are `ACTIVE`. |
| Prohibited-implementation search over the range        | Passed | Only documentation mentions AWS/Cognito/SES/password; no SDK, adapter, credential store, or production session added.         |
| Direct assembled-API probes (role ceiling, 404 oracle) | Run    | Results recorded under Findings; see P002-F1 and P002-F3.                                                                     |

The handoff's note that `pnpm exec playwright install chromium` was terminated is fair: the installed Chromium ran both browser tests to completion under my own rerun, so this is not a browser-coverage gap.

## Requirement And Acceptance-Criterion Assessment

| ID   | Verdict              | Evidence                                                                                                                                                                                                              |
| ---- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | Satisfied            | `apps/api/src/middleware/development-auth.ts:7-18` still yields only `{ userId, email }`; `apps/api/src/config/env.ts:64-65` fails startup on production + dev auth, covered by `apps/api/src/config/env.test.ts:27`. |
| AC2  | Satisfied            | `packages/shared/src/index.ts:75-78` normalizes/trims; `apps/api/src/modules/session/service.ts:9-15` accepts only `ACTIVE` users; unknown/invited/suspended share one 401 message (integration test lines 96-107).   |
| AC3  | Satisfied            | `apps/api/src/modules/session/service.ts:17-35` composes explicit DTO fields; repository selects named columns only (`session/repository.ts:22-43`).                                                                  |
| AC4  | Satisfied            | Only `tokenHash` is persisted (`access/service.ts:19`, `repository.ts:248`); the integration test asserts the stored hash equals SHA-256 of the token and that neither crosses the other boundary (lines 148-153).    |
| AC5  | Satisfied            | `access/service.ts:18,206,231` sets seven-day expiry; resend rotates hash/expiry and increments `resendCount` (`repository.ts:313-327`); revoke replaces the hash (`repository.ts:383-396`). See P002-F3 on coverage. |
| AC6  | Satisfied            | Partial unique index `organization_invitations_pending_email_unique` plus `isUniqueViolation` mapping; concurrent duplicate test asserts `[201, 409]` and exactly one pending row.                                    |
| AC7  | Satisfied            | `access/policy.ts:18-28` encodes the exact R6 table; internal-organization roles restricted at `policy.ts:30-35`; test lines 110-139 prove client-admin allow, elevated deny, developer deny, cross-tenant deny.      |
| AC8  | Satisfied            | New invitee inserted as `INVITED`; existing profile reused without overwrite; globally suspended user rejected (`repository.ts:200-237`, test lines 154-223).                                                         |
| AC9  | Satisfied            | Single transaction activates user, creates/reactivates membership, accepts, and audits (`repository.ts:413-512`).                                                                                                     |
| AC10 | Satisfied            | 410 `INVITATION_EXPIRED` and 400 `INVITATION_INVALID` mapped in `service.ts:143-152` and asserted for rotated, revoked, expired, and reused tokens.                                                                   |
| AC11 | Satisfied            | `SELECT … FOR UPDATE` on the token row plus a status-and-hash-guarded conditional update; concurrency test proves `[200, 400]`, one membership, one acceptance event.                                                 |
| AC12 | Satisfied            | All three P001 authorization joins now require `status = 'ACTIVE'` (`change-requests/repository.ts:40,65`); suspension immediately yields 403 and an empty session membership list (test lines 347-362).              |
| AC13 | Partial              | PATCH enforces ceilings, self-suspension, and last-owner protection, but the acceptance path performs an equivalent membership mutation without the same ceiling check. See **P002-F1**.                              |
| AC14 | Satisfied            | Reactivation restores exactly the membership's role capabilities (`service.ts:307-308`, test lines 364-378).                                                                                                          |
| AC15 | Satisfied            | Every mutation inserts its audit event inside the same transaction (`repository.ts:254,328,397,501,612`).                                                                                                             |
| AC16 | Satisfied            | Explicit DTO mapping in `service.ts:319-342`; newest-first ordering; test asserts no token, `tokenHash`, or `metadata` in the payload and 403 for a foreign tenant.                                                   |
| AC17 | Satisfied            | Strict Zod on params, query, and bodies in `access.routes.ts` and `session.routes.ts`; envelopes and `requestId` unchanged in `app.ts:98-105`.                                                                        |
| AC18 | Satisfied (untested) | Verified by direct probe: foreign/unknown invitation and membership identifiers return `404 NOT_FOUND`, unauthorized organizations return `403`. No automated test covers this. See **P002-F3**.                      |
| AC19 | Satisfied            | Sign-in, session context, acceptance, invitation management, membership actions, and audit history are all reachable and covered by component and browser tests.                                                      |
| AC20 | Satisfied            | Fragment scrubbed before the request (`InvitationAcceptance.tsx:16-25`); component test asserts empty hash and token absent from storage; e2e asserts `localStorage` contains no `token=`.                            |
| AC21 | Satisfied            | UI hiding proven in `AccessManagement.test.tsx:110-113` and the e2e run; independent API denial proven by the 403 cases in the integration suite.                                                                     |
| AC22 | Satisfied            | P001 integration tests unchanged and passing; Playwright list/create/refresh regression passes.                                                                                                                       |
| AC23 | Satisfied            | Migration is purely additive; `ADD COLUMN … DEFAULT 'ACTIVE' NOT NULL` migrated existing rows; verified directly against the real P001 development database; seed idempotent across two runs; no Drizzle drift.       |
| AC24 | Mostly               | Coverage is genuine and behavioural across all required layers; two named criteria lack an automated assertion. See **P002-F3**.                                                                                      |
| AC25 | Satisfied            | Exact SHAs, honest validation table, deviations, and pending gates recorded; no AWS or production-auth work entered the range.                                                                                        |

Non-goals NG1–NG12 were checked against the diff and none were breached. No AWS SDK, email adapter, password store, refresh token, cookie session, project-membership model, hard-delete endpoint, or rate-limiting framework was introduced. Architectural non-goals (no repository base classes, no policy engine, no event bus) are respected; `access/policy.ts` is 39 lines of plain typed lookup.

## Findings

### P002-F1 — Medium — Invitation acceptance rewrites memberships that the inviter may not manage

- **Affected:** R6 ("an actor cannot assign a role above the table's ceiling through create, resend, acceptance, or membership update"; the R6 _Assign/manage roles_ column), AC13.
- **Evidence:** `apps/api/src/modules/access/repository.ts:444-481` reactivates an existing `SUSPENDED` membership and overwrites `role` with `invitation.proposedRole` after checking only that the membership is not already `ACTIVE`. The PATCH path deliberately checks the target's _current_ role against the actor ceiling (`apps/api/src/modules/access/service.ts:283-292`: `!canAssignRole(context.actorRole, target.role)`); the acceptance path has no equivalent check. Because acceptance is unauthenticated and possession of the token is the credential (approved decision 6), the inviter who copies the link can redeem it themselves.
- **Impact:** A `CLIENT_ADMIN` — explicitly limited to `CLIENT_MEMBER` management — can reactivate and re-role a suspended `DEVELOPER`, `ADMIN`, or `OWNER` membership without the target user or a higher-privileged administrator, reversing a deliberate suspension. There is no escalation _above_ the actor's own ceiling (the resulting role is always one the actor may assign), which is why this is Medium rather than High, but it is an access-control decision the PATCH route refuses.
- **Reproduction** (assembled app, seeded test database, verified during this review):
  1. `GET /api/v1/organizations/<northstar>/members` as the owner; note Devon Developer's membership.
  2. As `admin@client.test` (`CLIENT_ADMIN`), `PATCH …/memberships/<devon>` → `403 FORBIDDEN`. Confirms the intended ceiling.
  3. As the owner, `PATCH …/memberships/<devon>` with `{"status":"SUSPENDED"}` → `200`, membership `DEVELOPER/SUSPENDED`.
  4. As `admin@client.test`, `POST …/invitations` for `developer@appsolo.test` with role `CLIENT_MEMBER` → `201`, response carries the acceptance URL.
  5. `POST /api/v1/invitations/accept` with that token → `200`.
  6. `GET …/members` as the owner → Devon's membership is now `CLIENT_MEMBER/ACTIVE`.
- **Recommended correction:** In `AccessRepository.acceptInvitation`, when an existing membership row is found, apply the same ceiling test used by `updateMembership` against the _inviter_ recorded on the invitation (`invitedByUserId`) and the membership's current role — or refuse acceptance with `INVITATION_INVALID` when the stored membership role is outside the inviter's assignable set. Equivalently, reject invitation creation at `repository.ts:229-237` when a non-active membership exists whose current role the actor cannot assign, instead of only checking for an `ACTIVE` one.

### P002-F2 — Medium — Development sign-out does not clear cached tenant data, so the next identity briefly sees the previous identity's data

- **Affected:** R9 ("Provide sign-out and current-user/organization context"), AC19, and the product principle that a user must never be shown data from an organization they are not authorized to access.
- **Evidence:** `apps/web/src/session/SessionProvider.tsx:53-57` removes only `['session']` from the query cache on sign-out, and `establish` (lines 33-37) seeds the new session without clearing anything else. Server-state keys are identity-independent: `['change-requests', projectId]` (`apps/web/src/features/change-requests/ChangeRequestList.tsx:9`), `['change-request', id]`, and `['members'|'invitations'|'access-events', organizationId]` (`apps/web/src/features/access/AccessManagement.tsx:40-51`). `AccessManagement` gates its loading state on `isLoading`, which is false when cached data exists, so stale data renders before the refetch resolves.
- **Impact:** After switching development identity in the same browser, the incoming user sees the previous user's change-request list, member list, invitation list, or access history until the background refetch returns — including cases where that refetch then returns `403`. The API boundary is not breached and no new data is fetched, but the browser displays another identity's tenant data. P001 could not reach this state because identity was a fixed build-time value; P002 introduces the switch.
- **Reproduction:** Sign in as `owner@appsolo.test`, open `/organizations/<northstar>/access`, sign out, sign in as `other@other-client.test`, then navigate to `/organizations/<northstar>/access`. The cached Northstar member table renders before the `403` error state replaces it. The same sequence with the default seeded project route shows the previous tenant's change requests.
- **Recommended correction:** Call `queryClient.clear()` (or remove all non-session queries) inside `signOut` and inside `establish` when the established user ID differs from the previous one. Optionally include the development user ID in the server-state query keys.

### P002-F3 — Medium — Two named acceptance criteria have no automated assertion, and the handoff records them as covered

- **Affected:** AC5, AC18, AC24, and `markdown/TESTING.md` ("A command that exits successfully without running a real checker is not a pass"; every validation result recorded honestly).
- **Evidence:**
  - AC18: `notes/P002/implementation-handoff.md` records "AC17-AC18 … 403 collections and 404 inaccessible nested records" as evidence, but `apps/api/src/modules/access/access.integration.test.ts` contains no `404` assertion (`grep -n "404" apps/api/src/modules/access/access.integration.test.ts` returns nothing). The 403 collection cases are covered; the 404 nested-identifier branch is not.
  - AC5: no test asserts the seven-day lifetime. The expiry cases work by backdating `expiresAt` directly (test lines 256-270), so a regression changing `sevenDaysInMilliseconds` (`apps/api/src/modules/access/service.ts:18`) or dropping the expiry reset on resend would not fail any test.
- **Impact:** The behaviours are correct today — I verified the 404 branch directly against the assembled app (foreign/unknown invitation IDs and unknown membership IDs both return `404 NOT_FOUND`; a non-member actor gets `403` first, which is also correct and non-oracular) — but neither is guarded against regression, and the handoff's evidence table overstates what the suite proves. Under the review contract, claimed-but-absent validation is missing evidence for those two criteria even though the implementation passes manual verification.
- **Recommended correction:** Add two assertions to `access.integration.test.ts`: an authorized administrator addressing an invitation ID and a membership ID from another organization receives `404`; and a freshly created invitation's `expiresAt` is seven days after a fixed injected clock, with resend resetting it. Then correct the AC17–AC18 and AC5 evidence rows in the handoff and phase record.

### P002-F4 — Low — Member DTOs report full capabilities for globally suspended users

- **Affected:** R5 ("Globally suspended users cannot authenticate even if a membership remains active"), AC14 presentation.
- **Evidence:** `apps/api/src/modules/access/service.ts:180` and `307-308` derive `capabilities` from membership status and role only, ignoring `userStatus`, which the same DTO already carries.
- **Impact:** An administrator viewing the member list sees a `SUSPENDED` user with an active membership listed as holding `SUBMIT_CHANGE_REQUESTS`, `MANAGE_INVITATIONS`, and so on. The capabilities are unreachable — authentication rejects the user at `development-auth.ts:14-15` — so this is presentation only, but it misrepresents effective access in the very screen used to audit it. The adjacent `userStatus` column mitigates the confusion.
- **Recommended correction:** Return `[]` when `userStatus !== 'ACTIVE'`, matching the existing treatment of suspended memberships.

### P002-F5 — Low — The invitation acceptance origin is silently derived from `CORS_ORIGIN[0]` and is undocumented

- **Affected:** R2/R9 (one local acceptance URL returned to the authorized caller), `markdown/contracts/ENVIRONMENT.md`, and the prompt's "add a validated public web acceptance-base URL only if the runtime cannot derive it safely".
- **Evidence:** `apps/api/src/app.ts:65-69` passes `config.CORS_ORIGIN[0] ?? 'http://localhost:5173'` as the web origin, consumed at `apps/api/src/modules/access/service.ts:212` and `237`. `CORS_ORIGIN` is a validated comma-separated list of one or more origins (`apps/api/src/config/env.ts:45-48`), so the first entry is not necessarily the browser origin an operator expects. The `??` fallback is unreachable because the schema enforces `.min(1)`. Neither `markdown/contracts/ENVIRONMENT.md` nor `markdown/contracts/API.md` states this coupling.
- **Impact:** If an operator lists more than one allowed origin, the copied acceptance link silently points at whichever origin happens to be first, producing a link the invitee cannot use. The e2e test already has to rewrite the hostname to `127.0.0.1` to work around this. No security consequence; the token is unaffected.
- **Recommended correction:** Either document the derivation explicitly in `ENVIRONMENT.md` and `API.md`, or introduce a dedicated validated `WEB_ACCEPTANCE_BASE_URL` (defaulting to `CORS_ORIGIN[0]`), and drop the unreachable fallback.

### P002-F6 — Low — The sidebar organization indicator shows the alphabetically first membership, not the organization in context

- **Affected:** `markdown/REVIEW_CHECKLIST.md` ("the sidebar, brand, organization indicator, and project context are present"), R9 (current-user/organization context).
- **Evidence:** `apps/web/src/layouts/DashboardLayout.tsx:15` renders `session?.memberships[0]?.organizationName`, and `apps/api/src/modules/session/repository.ts:42` orders memberships by organization name.
- **Impact:** The seeded owner belongs to `AppSolo` and `Northstar Demo Co.`; while viewing a Northstar project the sidebar reads "AppSolo". The page header itself shows the correct `organizationName · projectName` from the list response (`ChangeRequestList.tsx:26-35`), so this is a secondary label only, but it is misleading for any multi-membership user — which P002 makes the normal case.
- **Recommended correction:** Derive the sidebar label from the route's organization/project context, or replace it with a neutral label when the user holds more than one membership.

## Additional Observations (no action required)

- Tenant scoping is consistently applied: every organization-scoped repository method receives `organizationId`, every nested identifier is matched against it, and the actor context is re-resolved _inside_ each mutation transaction rather than trusted from the earlier service-level authorization. That is stronger than the minimum the prompt required.
- Concurrency handling is real, not decorative: `FOR UPDATE` on the token row for acceptance, `FOR UPDATE` on the invitation row for resend/revoke, a tenant advisory transaction lock plus `expectedUpdatedAt` for membership updates, and a partial unique index for duplicate pending invitations. The two concurrency tests exercise genuine parallel requests rather than sequential calls.
- Redaction is verified end to end: `apps/api/src/app.ts:37-46` redacts `req.body`, `authorization`, `cookie`, `x-dev-user-id`, and `DATABASE_URL`; the rerun API logs show `"x-dev-user-id":"[Redacted]"` and no token, hash, or email body anywhere.
- The seeded pending invitation stores a fixed non-derivable hash constant rather than the hash of a committed token, so no usable bearer token entered source control while still giving QA a visible pending row.
- `apps/api/package.json` switching to `vitest run --no-file-parallelism` is a necessary consequence of the new truncate-and-seed integration suite and is disclosed rather than hidden.
- The unauthenticated `POST /api/v1/invitations/accept` route has no throttling, so a token is guessable only by brute force against a 256-bit space. That is acceptable under NG10, and P011 remains the right home for rate limiting.
- `AccessService.updateMembership` contains a redundant `if (error instanceof AppError) throw error;` before `mapStateError`, which already rethrows non-`AccessStateError` values. Harmless duplication, not worth a change on its own.

## Severity Rationale

`markdown/FLOW.md` states that Blocker and High findings prevent a ready verdict, and that Medium and Low findings still require human disposition. I considered raising P002-F1 to High as an AC13 failure and did not, for a specific reason: no path in the acceptance flow grants a role _above_ the actor's own assignable set. `canAssignRole` still bounds the invitation's proposed role at creation, so an `ADMIN` cannot restore a suspended `OWNER` to `OWNER`, and a `CLIENT_ADMIN` cannot restore a suspended `CLIENT_ADMIN`. The defect is confined to modifying a membership whose _current_ role sits above the actor's ceiling, and the change is always downward plus a reactivation. That is a real policy inconsistency and a partial AC13 failure, but it is not a privilege escalation, a tenant breach, or an auth bypass, so Medium is the honest rating.

No Blocker or High finding exists: there is no cross-tenant server-side disclosure, no data loss, no destructive migration, no leaked secret, no unusable build, and no production-environment auth exposure.

## Verdict

`ready with non-blocking observations`

P002 is substantially complete, well-structured, and materially stronger than the prompt's minimum on tenant scoping, concurrency handling, and log redaction. Every requirement R1–R10 is implemented and every acceptance criterion except AC13 is satisfied by evidence I reproduced independently; AC13 is partially satisfied and AC18/AC5 are correct but unguarded by tests.

This verdict is not an approval to close the phase. Three Medium findings — P002-F1 (role-ceiling bypass through acceptance), P002-F2 (stale cross-identity data after development sign-out), and P002-F3 (two acceptance criteria recorded as tested that are not) — all require human disposition, and P002-F3 additionally requires correcting the AC5 and AC17–AC18 evidence rows in `notes/P002/implementation-handoff.md` and the phase record regardless of whether the test gap is closed now or deferred.

Per `markdown/FLOW.md`, P002 must remain `review_pending` until the human dispositions each finding; no fix is authorized before that, and human Q1–Q10 QA and integration approval remain outstanding.
