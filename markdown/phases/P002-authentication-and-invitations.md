---
id: P002
title: Authentication And Invitations
status: review_pending
owner: codex
reviewer: claude
prompt: prompts/active/P002-authentication-and-invitations.md
depends_on: [P001]
base_branch: main
base_sha: d3af5e9b4b3780ac41060fc51888ed8c413a1fe7
candidate_sha: 13cb4de63170b9d5e51d3400e38395b8acc12189
risk: high
human_qa_required: true
---

# P002 — Authentication And Invitations

## Outcome

Establish provider-neutral user access lifecycle, invitations, membership administration, and authorization capabilities without yet coupling business modules to Cognito.

## Candidate Scope

- Invitation creation, expiration, resend, and acceptance.
- Membership administration and role capabilities.
- Authentication/session-facing UI using an approved provider-neutral approach.
- Audit history for access changes.

## Candidate Non-Goals

- Production Cognito integration.
- SES delivery.
- AWS infrastructure.

## Approval State

The human approved P002 specification version 1 on 2026-07-26.

- Active prompt: `prompts/active/P002-authentication-and-invitations.md`, specification version 1.
- Draft basis: local `main` at `ccf344a406085a92669d867cc068e67c55519af3`.
- Human approval: granted on 2026-07-26.
- Implementation: authorized, subject to mandatory repository revalidation and Git-boundary establishment.
- Dependencies: P001 is complete.

The approved prompt contains stable R, AC, V, Q, and NG identifiers. Its invitation lifetime/state, role ceiling, local delivery, development-session, invitee-profile, token-transport, and audit-retention decisions are binding for P002.

## Evidence

- Drafted: 2026-07-26.
- Approved: 2026-07-26.
- Draft basis SHA: `ccf344a406085a92669d867cc068e67c55519af3`.
- Base branch: local `main`.
- Base SHA: `d3af5e9b4b3780ac41060fc51888ed8c413a1fe7`.
- Implementation branch: `phase/P002-authentication-and-invitations`.
- Prompt revalidation: specification version 1 remains valid against the approved local-main boundary; implementation began on 2026-07-26.
- Candidate SHA: `13cb4de63170b9d5e51d3400e38395b8acc12189`.
- Candidate commit: `P002: implement authentication and invitations`.
- Review target: `d3af5e9b4b3780ac41060fc51888ed8c413a1fe7..13cb4de63170b9d5e51d3400e38395b8acc12189`.
- Claude review: complete; verdict `ready with non-blocking observations`.
- Human disposition: P002-F1 through P002-F6 accepted on 2026-07-26.
- Review-fix SHA: `7ecacc31f0b5bac6d8bb773e260a01d1b3592818`.
- Accepted-fix range: `13cb4de63170b9d5e51d3400e38395b8acc12189..7ecacc31f0b5bac6d8bb773e260a01d1b3592818`.
- Focused review: P002-F1 through P002-F6 verified; P002-F7 reported with verdict `ready with non-blocking observations`.
- Human disposition: P002-F7 accepted on 2026-07-26.
- F7 review-fix SHA: `0ccb535cd5e0c73184fc626ebd9233b3d2518482`.
- F7 accepted-fix range: `3ee25937fba79491ec8a13814187175f8b3367d5..0ccb535cd5e0c73184fc626ebd9233b3d2518482`.
- Round 3 focused review: P002-F7 verified fixed; no new finding.
- Final review verdict: `ready with non-blocking observations`; no finding remains open.
- Review handoff: `notes/P002/implementation-handoff.md`.
- Review: clear; human QA and integration approval remain.
- Human QA: not started.
- Completion: not eligible.

## Revalidation

- Local `main` and the supplied approval commit both resolved to `d3af5e9b4b3780ac41060fc51888ed8c413a1fe7`; local `main` was 18 commits ahead of `origin/main`.
- The initial working tree was clean. No unrelated work required preservation.
- Branch `phase/P002-authentication-and-invitations` was created from the exact local-main base.
- Node `v24.15.0`, pnpm `11.10.0`, and Docker `29.6.2` matched the supported repository environment.
- Current code matched the prompt assumptions: no invitation/audit persistence, membership lifecycle, user-facing session, or active-membership filter existed.
- Verdict: approved specification version 1 remained valid with no scope revision.

## Implementation

- Shared strict schemas and DTOs now define session, capabilities, invitations, membership updates, and access events.
- Additive Drizzle migration `0002_regular_magneto.sql` adds membership lifecycle, secure invitation hashes, immutable access audit, indexes, constraints, and restrictive foreign keys while retaining the P001 index/data.
- Focused session/access API modules enforce active tenant membership, exact role ceilings, atomic token lifecycle, optimistic membership state, lockout protection, and explicit DTO mapping.
- P001 authorization now requires `organization_memberships.status = ACTIVE`.
- The browser supports explicit local sign-in/out, provider-neutral session context, fragment-scrubbing acceptance, access administration, and role-aware control visibility.
- Tests cover shared contracts, PostgreSQL API behavior/concurrency, component states/actions, and real browser invite acceptance plus P001 regression.
- Durable API/data/security/environment/integration/testing/architecture contracts, README, and relevant accepted ADRs match implemented behavior.
- Accepted review fixes enforce the ceiling against suspended membership roles
  throughout the invitation lifecycle, clear cross-identity browser caches, remove
  capabilities from globally suspended users, validate the invitation-link web
  origin, and render route-correct organization context.
- Fixed-clock and cross-tenant nested-ID regressions now prove the exact
  seven-day create/resend expiry and inaccessible invitation/membership `404`
  behavior that the original evidence overclaimed.
- Invitation tokens now carry a persisted authorizing-role snapshot. Acceptance
  remains valid after inviter demotion/suspension while still rechecking current
  target membership role against the issuance-time ceiling; authorized resend
  rotates and re-anchors the snapshot.
- Additive migration `0003_common_sue_storm.sql` backfills existing invitation
  snapshots before enforcing the new non-null invariant.

## Deviations

- No approved requirement or non-goal deviation.
- `pnpm exec playwright install chromium` was terminated after 90 seconds without output; the already-installed browser was proven operational by two passing Playwright tests.

## Automated Validation

| ID  | Command                                                 | Result | Evidence                                                                                                               |
| --- | ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| V1  | `node scripts/check-scaffolding.mjs`                    | Passed | 27 required files and 11 phase records validated.                                                                      |
| V2  | `pnpm install`                                          | Passed | Five workspace projects already up to date; command exited 0 despite non-blocking update-check DNS.                    |
| V3  | `pnpm docker:up`                                        | Passed | Compose PostgreSQL on configured host port 5433 reached healthy.                                                       |
| V4  | `pnpm db:migrate`                                       | Passed | Additive F7 migration backfilled the existing development invitation and enforced its non-null authorization snapshot. |
| V5  | `pnpm db:seed` twice                                    | Passed | Both runs reported seed data present without duplication.                                                              |
| V6  | `pnpm --filter @appsolo/database test:prepare`          | Passed | Guarded reset targeted only `appsolo_client_hub_test`; migration and seed passed.                                      |
| V7  | `pnpm --filter @appsolo/database generate`              | Passed | Drizzle reported no schema changes after checked-in migration/snapshot.                                                |
| V8  | `pnpm lint`                                             | Passed | ESLint and Prettier passed.                                                                                            |
| V9  | `pnpm typecheck`                                        | Passed | Strict checks passed in shared, database, API, and web.                                                                |
| V10 | `pnpm test`                                             | Passed | 7 shared/database tests passed.                                                                                        |
| V11 | `pnpm test:api`                                         | Passed | 23 API/config/health/PostgreSQL tests passed across 4 files.                                                           |
| V12 | `pnpm test:web`                                         | Passed | 15 environment/component tests passed across 6 files.                                                                  |
| V13 | `pnpm build`                                            | Passed | All four package/application builds completed.                                                                         |
| V14 | `pnpm test:e2e`                                         | Passed | 2 real browser/API/test-PostgreSQL tests passed.                                                                       |
| V15 | direct health/session/invalid-token/cross-tenant probes | Passed | Returned documented 200 session/health, 400 invalid invitation, and 403 tenant denial.                                 |
| V16 | assembled structured-log probe                          | Passed | Fake sign-in email/token and database URL were absent; development header rendered `[Redacted]`.                       |
| V17 | `node scripts/generate-phase-index.mjs --check`         | Passed | Canonical phase index current after evidence update.                                                                   |
| V18 | exact candidate and accepted-fix `git diff --check`     | Passed | Candidate, `13cb4de..7ecacc3`, and `3ee2593..0ccb535` ranges have no whitespace errors.                                |
| V19 | manifest/source search for prohibited implementation    | Passed | No added AWS SDK, Cognito, SES, password, refresh-token, or production-session implementation.                         |
| V20 | `node scripts/validate-phase.mjs P002`                  | Passed | Phase structure and required pending review/QA note files validated.                                                   |

## Review

- Candidate and review-fix commits are immutable.
- Claude completed the initial independent review with verdict `ready with non-blocking observations`.
- Claude verified P002-F1 through P002-F6, then reported P002-F7.
- The human accepted P002-F7, and `0ccb535cd5e0c73184fc626ebd9233b3d2518482` applies it.
- Claude's Round 3 verification found F7 fixed, raised no new finding, and retained
  the final verdict `ready with non-blocking observations`.
- Human QA remains pending.
- No push, remote creation, origin reset, or production/external service action occurred.

## Completion Gate

- Requirements implemented: Yes, including P002-F1 through P002-F7.
- Automated validation: passed as recorded above.
- Independent review clear: Yes; all seven findings independently verified fixed.
- Findings dispositioned: Yes; P002-F1 through P002-F7 accepted, fixed, and verified.
- Required human QA complete: No.
- Human integration/completion approval: No.
- P002 status must remain `review_pending`; Codex has not marked it complete.
