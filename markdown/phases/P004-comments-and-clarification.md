---
id: P004
title: Comments And Clarification
status: qa_pending
owner: codex
reviewer: claude
prompt: prompts/active/P004-comments-and-clarification.md
depends_on: [P003]
base_branch: main
base_sha: c64e42d6f08901b7dd72be9d11bfc37ed3af3149
candidate_sha: f7d5d43fa43fafbccbc8f2525b31c9d01a87b045
risk: high
human_qa_required: true
---

# P004 — Comments And Clarification

## Outcome

Add request communication while preserving strict internal-only and client-visible boundaries.

## Approved Scope

- Create and list authorized comments.
- Internal-only visibility enforcement.
- Ordered append-only request conversation.
- P003 clarification discussion continuity without comment-driven status changes.
- Client-safe DTOs and tests.
- Additive data integrity and deterministic seed coverage.

## Approved Non-Goals

- Real-time chat.
- Comment editing, deletion, reactions, or nested threads.
- Changes to P003 estimate decisions or lifecycle ownership.
- Email delivery.
- File attachments.
- P005 work/status behavior and all later cloud phases.

## Approval State

The human approved P004 specification version 1 and all twelve binding decisions
on 2026-07-27.

- Active prompt: `prompts/active/P004-comments-and-clarification.md`,
  specification version 1.
- Draft basis: authoritative local `main` at
  `a6a3e728e67fa43004bb08d4b64b0e48aec5372f`.
- Human approval: granted on 2026-07-27.
- Binding decisions: all twelve approved without revision.
- Implementation: authorized, subject to mandatory repository revalidation and
  Git-boundary establishment.
- Dependencies: P003 is complete and locally integrated.
- Revalidation: passed on 2026-07-27 against the approved local-main boundary;
  the active prompt remains valid without scope revision.
- Implementation branch: `phase/P004-comments-and-clarification`.
- Implementation base: immutable approval commit
  `c64e42d6f08901b7dd72be9d11bfc37ed3af3149` on local `main`.

The approved prompt contains stable R, AC, V, Q, and NG identifiers. Its
conversation model, append-only behavior, capability matrix, safe internal
default, body contract, clarification ownership, lifecycle availability,
historical authorship, visibility-oracle prevention, and notification boundary
are binding for P004.

## Evidence

- Drafted: 2026-07-27.
- Approved: 2026-07-27.
- Draft basis SHA: `a6a3e728e67fa43004bb08d4b64b0e48aec5372f`.
- Approval boundary revalidated: authoritative local `main` at
  `06c1e0714ea18b1b37173917a45c023220f49e30`.
- Base branch: `main`.
- Base SHA: `c64e42d6f08901b7dd72be9d11bfc37ed3af3149`.
- Revalidated: 2026-07-27; approved assumptions matched the current schema,
  seed, capability policy, API composition, request detail UI, P003
  clarification lifecycle, logging redaction, and dependency manifests.
- Implementation started: 2026-07-27 on
  `phase/P004-comments-and-clarification`.
- Active prompt: `prompts/active/P004-comments-and-clarification.md`, version 1.
- Draft authorization: human, 2026-07-27.
- Candidate SHA: `f7d5d43fa43fafbccbc8f2525b31c9d01a87b045`.
- Candidate commit: `P004: implement comments and clarification`.
- Review handoff: `notes/P004/implementation-handoff.md`.
- Review: complete on 2026-07-27 with verdict `changes requested`; P004-F1
  through P004-F5 were accepted by the human for correction.
- Review-fix SHA: `4c328f74a57076fa19f57937ae30867d5fabcbd2`.
- Review-fix commit: `P004: address accepted review findings`.
- Accepted-fix range:
  `426e0491212d55ad4018055b7705779fab337062..4c328f74a57076fa19f57937ae30867d5fabcbd2`.
- Focused fix verification: complete on 2026-07-27; Claude independently
  verified P004-F1 through P004-F5 fixed at
  `4c328f74a57076fa19f57937ae30867d5fabcbd2` and issued final verdict
  `ready with non-blocking observations`.
- Human QA: Q1-Q10 passed by explicit human attestation on 2026-07-27; see
  `notes/P004/qa.md`.
- Human completion and local integration approval: not yet granted.
- Completion: all implementation, validation, review, disposition, and QA gates
  are satisfied; explicit human integration/completion approval remains.

## Validation Evidence

| ID  | Command                                         | Result | Evidence                                                                                                          |
| --- | ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| V1  | `node scripts/check-scaffolding.mjs`            | Passed | 27 required files and 11 phase records.                                                                           |
| V2  | `pnpm install`                                  | Passed | All five workspace projects were already up to date with pnpm 11.10.0.                                            |
| V3  | `pnpm docker:up`                                | Passed | Local PostgreSQL Compose container reached healthy.                                                               |
| V4  | `pnpm db:migrate`                               | Passed | Additive P004 migration `0006_rapid_blockbuster.sql` applied to existing development data.                        |
| V5  | `pnpm db:seed` twice                            | Passed | Both runs completed without duplicate comments or related fixtures.                                               |
| V6  | `pnpm --filter @appsolo/database test:prepare`  | Passed | Only the allowlisted `appsolo_client_hub_test` database was reset, migrated, and seeded.                          |
| V7  | `pnpm --filter @appsolo/database generate`      | Passed | Drizzle reported no schema changes after checked-in migration `0006` and its snapshot.                            |
| V8  | `pnpm lint`                                     | Passed | ESLint and Prettier passed after formatting the generated snapshot/journal and newest test.                       |
| V9  | `pnpm typecheck`                                | Passed | Strict shared, database, API, and web checks passed.                                                              |
| V10 | `pnpm test`                                     | Passed | 17 shared and 8 database tests passed, including strict bodies and PostgreSQL `23514` checks.                     |
| V11 | `pnpm test:api`                                 | Passed | 43 tests in 6 files passed against PostgreSQL, including P004 and P001/P002/P003 regressions.                     |
| V12 | `pnpm test:web`                                 | Passed | 24 tests in 8 files passed, including safe reset, client redaction, recovery, guidance, and pagination.           |
| V13 | `pnpm build`                                    | Passed | All four workspace package/application builds completed.                                                          |
| V14 | `pnpm test:e2e`                                 | Passed | 4 real Playwright/API/PostgreSQL flows passed, including internal/shared clarification comments.                  |
| V15 | direct isolated SQL/API probe                   | Passed | Confirmed filtered offset count 0, no client leak, 403/404 safety, `23514`, lifecycle stability, and two creates. |
| V16 | captured structured-log probe                   | Passed | Body/auth/cookie/URL sentinels were absent and the development identity header was redacted.                      |
| V17 | `node scripts/generate-phase-index.mjs --check` | Passed | Canonical phase index is current.                                                                                 |
| V18 | `git diff --check <base_sha>..<candidate_sha>`  | Passed | Exact immutable range `c64e42d6..f7d5d43f` has no whitespace errors.                                              |
| V19 | prohibited implementation/dependency searches   | Passed | No deferred comment mutation, service/chat dependency, or prohibited-scope path entered the diff.                 |
| V20 | `node scripts/validate-phase.mjs P004`          | Passed | Canonical phase and pending review/disposition/QA note structure is valid.                                        |

Interim validation results are preserved honestly:

- The first strict typecheck found a repository result union that did not
  discriminate its denial outcomes; the type was corrected and the
  authoritative rerun passed.
- Initial local database commands and tests were blocked by sandbox Docker,
  IPC, and localhost restrictions; the exact elevated reruns passed.
- The first API rerun expected a membership-suspended actor to receive `401`;
  the existing auth contract correctly authenticates the active global user and
  returns tenant-safe `404`. The test now separately proves membership `404`
  and global-user `401`, and 43 tests pass.
- Three iterations of the new Playwright scenario exposed only readiness and
  locator assumptions. Assertions were aligned with route-preserving sign-in
  and exact accessible controls; the authoritative rerun passed all 4 tests.
- One prohibited-scope search matched table names in test-database truncation;
  the runtime-source and changed-path searches passed.
- Candidate V16 covered only a successful request and did not exercise
  database-error serialization. Claude's forced error-path probe superseded
  that limited evidence and produced P004-F1.

### Accepted Review-Fix Validation

| Command                                                     | Result | Evidence                                                                                               |
| ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `pnpm docker:up`                                            | Passed | Existing local PostgreSQL Compose service reported healthy.                                            |
| `pnpm db:migrate`                                           | Passed | All checked-in migrations applied; the accepted fixes add no migration.                                |
| `pnpm db:seed` twice                                        | Passed | Both idempotence runs reported seed data present.                                                      |
| `pnpm --filter @appsolo/database generate`                  | Passed | Drizzle reported `No schema changes, nothing to migrate`.                                              |
| `pnpm lint`                                                 | Passed | ESLint and Prettier passed.                                                                            |
| `pnpm typecheck`                                            | Passed | Strict shared, database, API, and web checks passed.                                                   |
| `pnpm test`                                                 | Passed | 17 shared and 8 database tests passed, including null-character rejection.                             |
| `pnpm test:api`                                             | Passed | 44 tests in 6 files passed, including field-specific null validation and forced error-log redaction.   |
| `pnpm test:web`                                             | Passed | 26 tests in 8 files passed, including created-comment targeting and exact-full pagination boundaries.  |
| `pnpm build`                                                | Passed | All four workspace builds completed.                                                                   |
| `pnpm test:e2e`                                             | Passed | All 4 real browser/API/PostgreSQL flows passed.                                                        |
| scaffolding, phase-index, and P004 validation               | Passed | 27 required files, 11 phases, current generated index, and valid P004 structure.                       |
| review-fix `git diff --check` and scope/dependency searches | Passed | No whitespace error, dependency change, deferred mutation, service/chat, AWS, or later-phase addition. |

Accepted-fix totals are 17 shared, 8 database, 44 API, 26 component, and 4
Playwright tests: 99 passing tests across all required layers.

Accepted-fix interim results are preserved honestly:

- The first forced database-error log test failed because `pino-http`
  installed its own request-child `err` serializer. The safe serializer was
  added to both the base and HTTP logger configurations; the focused and final
  44-test API reruns passed without the sentinel, query, parameters, stack, or
  driver message.
- The first accepted-fix `pnpm test` attempt passed all shared tests but five
  database assertions received sandbox `EPERM` instead of PostgreSQL `23514`.
  The exact approved local-database rerun passed all 17 shared and 8 database
  tests.

## Completion Gate

- Requirements implemented: Yes, including P004-F1 through P004-F5 at
  `4c328f74a57076fa19f57937ae30867d5fabcbd2`.
- Automated validation: Passed for the candidate and accepted-fix boundaries.
- Independent review clear: Yes; every accepted finding was independently
  verified fixed; Claude's final verdict is ready with non-blocking
  observations.
- Findings dispositioned: Yes; P004-F1 through P004-F5 are accepted, fixed,
  and independently verified.
- Required human QA complete: Yes; Q1-Q10 passed by explicit human attestation
  on 2026-07-27.
- Human integration and completion approval: No.
- Ready for integration: Yes, pending explicit human integration/completion
  approval.
