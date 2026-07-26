---
id: P003
title: Estimates And Approval Workflow
status: review_pending
owner: codex
reviewer: claude
prompt: prompts/active/P003-estimates-and-approval-workflow.md
depends_on: [P002]
base_branch: main
base_sha: 274a9897c9fc8c681b4d1eac13ca8b16c0107a62
candidate_sha: 9c9ab03899a5295cbcd54a3f22279c1280b5911f
risk: high
human_qa_required: true
---

# P003 — Estimates And Approval Workflow

## Outcome

Create exact, durable estimate and client approval workflows linked to change requests.

## Candidate Scope

- Draft and submit estimates.
- Exact decimal hours, rates, and cost.
- Approve, reject, or request clarification.
- Transactional status and history updates.

## Candidate Non-Goals

- Payments or invoicing.
- Email notifications.
- Multi-currency.

## Approval State

The human approved P003 specification version 1 on 2026-07-26.

- Active prompt: `prompts/active/P003-estimates-and-approval-workflow.md`,
  specification version 1.
- Draft basis: authoritative local `main` at
  `745892af6c9393838e490f12ddaa3536a9524f88`.
- Human approval: granted on 2026-07-26.
- Implementation: authorized, subject to mandatory repository revalidation and
  Git-boundary establishment.
- Dependencies: P002 is complete and locally integrated.
- Revalidation: passed on 2026-07-26 against the approved local-main boundary;
  the active prompt remains valid without scope revision.
- Implementation branch: `phase/P003-estimates-and-approval-workflow`.
- Implementation base: local `main` at
  `274a9897c9fc8c681b4d1eac13ca8b16c0107a62`.

The approved prompt contains stable R, AC, V, Q, and NG identifiers. Its exact
decimal and rounding policy, implicit currency, estimate-management and approval
capabilities, draft/submission visibility, revision/supersession lifecycle,
response-note requirements, and concurrency behavior are binding for P003.

## Evidence

- Drafted: 2026-07-26.
- Approved: 2026-07-26.
- Draft basis SHA: `745892af6c9393838e490f12ddaa3536a9524f88`.
- Base branch: `main`.
- Base SHA: `274a9897c9fc8c681b4d1eac13ca8b16c0107a62`.
- Revalidated: 2026-07-26; approved assumptions matched the current schema,
  seed, capability policy, API composition, request detail UI, and dependency
  manifests.
- Implementation started: 2026-07-26 on
  `phase/P003-estimates-and-approval-workflow`.
- Candidate SHA: `9c9ab03899a5295cbcd54a3f22279c1280b5911f`.
- Candidate commit: `P003: implement estimates and approval workflow`.
- Review: pending independent Claude review.
- Human QA: not started.
- Completion: not eligible.

## Validation Evidence

| ID  | Command                                         | Result | Evidence                                                                                         |
| --- | ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| V1  | `node scripts/check-scaffolding.mjs`            | Passed | 27 required files and 11 phase records.                                                          |
| V2  | `pnpm install`                                  | Passed | Five workspace projects already up to date.                                                      |
| V3  | `pnpm docker:up`                                | Passed | Local PostgreSQL Compose container reached healthy.                                              |
| V4  | `pnpm db:migrate`                               | Passed | Additive P003 migration applied to existing P002 development data.                               |
| V5  | `pnpm db:seed` twice                            | Passed | Both runs completed without duplicate estimates, responses, or history.                          |
| V6  | `pnpm --filter @appsolo/database test:prepare`  | Passed | Only the allowlisted `appsolo_client_hub_test` database was reset, migrated, and seeded.         |
| V7  | `pnpm --filter @appsolo/database generate`      | Passed | Drizzle reported no schema changes after migration `0004` and its snapshot.                      |
| V8  | `pnpm lint`                                     | Passed | ESLint and Prettier passed.                                                                      |
| V9  | `pnpm typecheck`                                | Passed | Strict shared, database, API, and web checks passed.                                             |
| V10 | `pnpm test`                                     | Passed | 15 shared and 4 database tests passed, including exact arithmetic and stored-cost enforcement.   |
| V11 | `pnpm test:api`                                 | Passed | 31 tests in 5 files passed against PostgreSQL.                                                   |
| V12 | `pnpm test:web`                                 | Passed | 19 tests in 7 files passed.                                                                      |
| V13 | `pnpm build`                                    | Passed | All four workspace builds completed.                                                             |
| V14 | `pnpm test:e2e`                                 | Passed | 3 real Playwright/API/PostgreSQL flows passed.                                                   |
| V15 | direct isolated API probes                      | Passed | Exact strings, zero client drafts, 404 tenant denial, stale 409, and one-response 409 confirmed. |
| V16 | captured structured-log probe                   | Passed | Probe bodies/notes, database URLs, and credentials were absent; dev identity was redacted.       |
| V17 | `node scripts/generate-phase-index.mjs --check` | Passed | Canonical phase index current at review handoff.                                                 |
| V18 | `git diff --check <base_sha>..<candidate_sha>`  | Passed | Exact immutable candidate range has no whitespace errors.                                        |
| V19 | prohibited implementation/dependency searches   | Passed | No added P003 non-goal, AWS SDK, Cognito, SES, billing, comment, or time-tracking behavior.      |
| V20 | `node scripts/validate-phase.mjs P003`          | Passed | Required phase and pending review/QA note structure valid.                                       |

## Review

- Review target:
  `274a9897c9fc8c681b4d1eac13ca8b16c0107a62..9c9ab03899a5295cbcd54a3f22279c1280b5911f`.
- Implementation handoff: `notes/P003/implementation-handoff.md`.
- Independent review: pending.
- Finding disposition: pending.
- Human QA Q1-Q10: not run.
- No push, remote creation, pull, origin reset, history rewrite, or merge occurred.

## Completion Gate

- Requirements implemented: candidate evidence says yes; independent review pending.
- Automated validation: passed as recorded above.
- Independent review clear: No; pending.
- Findings dispositioned: No findings exist yet; human disposition pending review.
- Required human QA complete: No; Q1-Q10 are not run.
- Human integration and completion approval: No.
- Ready for integration: No.
