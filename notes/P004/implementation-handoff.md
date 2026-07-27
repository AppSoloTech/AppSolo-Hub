# P004 Implementation Handoff For Claude

> Status: Review pending. Candidate implementation is immutable; independent
> review and human QA have not started.

## Review Target

- Approval/base branch: authoritative local `main`
- Approval/base SHA: `c64e42d6f08901b7dd72be9d11bfc37ed3af3149`
- Approval commit: `P004: approve comments and clarification phase`
- Implementation branch: `phase/P004-comments-and-clarification`
- Candidate SHA: `f7d5d43fa43fafbccbc8f2525b31c9d01a87b045`
- Candidate commit: `P004: implement comments and clarification`
- Exact review range:
  `git diff c64e42d6f08901b7dd72be9d11bfc37ed3af3149..f7d5d43fa43fafbccbc8f2525b31c9d01a87b045`
- Exact diff check:
  `git diff --check c64e42d6f08901b7dd72be9d11bfc37ed3af3149..f7d5d43fa43fafbccbc8f2525b31c9d01a87b045`
- Candidate size: 31 files, 3,432 insertions, 51 deletions.

Local `main` was authoritative, clean, and exactly
`06c1e0714ea18b1b37173917a45c023220f49e30` before approval. The local approval
commit is the implementation base. No pull, push, merge, reset, history rewrite,
remote creation, AWS action, or external-service action occurred.

## Revalidation

- Mandatory product, architecture, flow, phase, prompt, contract, testing, and
  accepted ADR sources were read completely in the prescribed order.
- Node `v24.15.0`, pnpm `11.10.0`, Docker `29.6.2`, and Compose `5.3.1` were
  inspected.
- The existing comment table/enum/fixtures, missing ID tie-breaker and body
  check, missing comment contracts/capabilities/API/UI, active membership
  boundary, P003 clarification lifecycle, request-body redaction, and
  request-detail composition all matched the approved prompt.
- Verdict: approved specification version 1 remained valid without revision.

## Implemented Scope

- Centralized `VIEW_COMMENTS`, `CREATE_CLIENT_COMMENTS`,
  `VIEW_INTERNAL_COMMENTS`, and `CREATE_INTERNAL_COMMENTS` capabilities with
  the exact `OWNER`/`ADMIN`/`DEVELOPER` and client-role matrix.
- Strict trimmed 1–5,000 character body and visibility schemas, explicit
  comment/meta DTOs, 50/0 default pagination, and rejection of unknown or
  server-owned fields.
- Tenant-scoped list/create repository and service paths that require active
  user, active client organization, active project, active tenant membership,
  capability, request scope, and visibility authorization.
- SQL visibility filtering before oldest-first `(created_at, id)` ordering,
  pagination, returned page count, author join, and DTO construction.
- Append-only create behavior with server-owned request, author, ID, and
  timestamps; no edit/delete/restore/visibility mutation route.
- Additive `0006_rapid_blockbuster.sql` body check and deterministic ordering
  indexes with matching Drizzle snapshot and no drift.
- Deterministic twice-idempotent shared/internal, equal-time, clarification,
  suspended-author, and other-tenant seed fixtures.
- Accessible responsive conversation feed, page navigation, explicit
  visibility labels, recoverable errors, success focus/announcement, and
  identity-scoped query invalidation.
- Internal composer safe default/reset to `INTERNAL_ONLY`; client composer has
  no internal selector, internal count, internal placeholder, or internal row.
- Clarification guidance points to the immutable P003 response reason and
  explicitly states that comments do not resolve or revise lifecycle state.
- API, data, security, integration, testing, architecture, README, and accepted
  tenant-authorization ADR updates.

## Requirement And Acceptance Mapping

| Requirement | Acceptance criteria | Primary evidence                                                                                              |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| R1          | AC1-AC3             | Central policy, session matrix, active scope joins, owner/admin/developer/client and lifecycle denial tests.  |
| R2          | AC4-AC7             | Strict shared schema, server-owned create, SQL body check, equal-time order, concurrency, and route search.   |
| R3          | AC8-AC11            | SQL pre-pagination visibility predicate, filtered page counts, safe 403/404, explicit six-field DTO tests.    |
| R4          | AC12-AC14           | Clarification state/history comparison and revision-submission test retaining reason/comments/visibility.     |
| R5          | AC15-AC16           | Strict list/create route/query/body tests, envelopes/request IDs, and captured structured-log sentinel probe. |
| R6          | AC17-AC20           | Four component tests plus real internal/client Playwright clarification flow and narrow-layout CSS.           |
| R7          | AC21-AC22           | Migration/snapshot, `23514` probes/tests, stable indexes, no drift, twice-idempotent deterministic seed.      |
| R8          | AC23-AC24           | 96 passing automated tests, P001/P002/P003 regressions, contracts, exact Git evidence, and scope searches.    |

## Migration And Seed Evidence

- `pnpm db:migrate` applied `0006_rapid_blockbuster.sql` to existing P003
  development data without deleting or rewriting comment rows.
- The migration replaces the two earlier comment indexes with ID-tie-breaker
  equivalents and adds `comments_body_length`; restrictive foreign keys and the
  existing visibility enum remain unchanged.
- `pnpm db:seed` passed twice without duplication.
- `pnpm --filter @appsolo/database test:prepare` reset only the allowlisted test
  database and reapplied every migration and seed.
- `pnpm --filter @appsolo/database generate` reported
  `No schema changes, nothing to migrate`.
- Direct whitespace-body SQL update returned PostgreSQL `23514`.

## Validation Evidence

| ID  | Command                                         | Result | Evidence                                                                                             |
| --- | ----------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| V1  | `node scripts/check-scaffolding.mjs`            | Passed | 27 required files and 11 phase records.                                                              |
| V2  | `pnpm install`                                  | Passed | Five workspace projects already up to date.                                                          |
| V3  | `pnpm docker:up`                                | Passed | Local PostgreSQL Compose service healthy.                                                            |
| V4  | `pnpm db:migrate`                               | Passed | Additive migration `0006_rapid_blockbuster.sql` applied to existing development data.                |
| V5  | `pnpm db:seed` twice                            | Passed | Both idempotence runs completed without duplicate fixtures.                                          |
| V6  | `pnpm --filter @appsolo/database test:prepare`  | Passed | Guarded isolated test reset, migration, and seed completed.                                          |
| V7  | `pnpm --filter @appsolo/database generate`      | Passed | No schema drift after the checked-in migration/snapshot.                                             |
| V8  | `pnpm lint`                                     | Passed | ESLint and Prettier passed.                                                                          |
| V9  | `pnpm typecheck`                                | Passed | Strict shared, database, API, and web checks passed.                                                 |
| V10 | `pnpm test`                                     | Passed | 17 shared and 8 database tests.                                                                      |
| V11 | `pnpm test:api`                                 | Passed | 43 tests in 6 files against isolated PostgreSQL.                                                     |
| V12 | `pnpm test:web`                                 | Passed | 24 tests in 8 files.                                                                                 |
| V13 | `pnpm build`                                    | Passed | Shared, database, API, and web builds completed.                                                     |
| V14 | `pnpm test:e2e`                                 | Passed | 4 real browser/API/PostgreSQL flows.                                                                 |
| V15 | direct isolated SQL/API probe                   | Passed | Filtered page count 0/no leak, 403, two 404s, lifecycle stable, `23514`, and concurrent `[201,201]`. |
| V16 | captured structured-log probe                   | Passed | Body/auth/cookie/URL sentinels absent; `x-dev-user-id` redacted.                                     |
| V17 | `node scripts/generate-phase-index.mjs --check` | Passed | Generated index current.                                                                             |
| V18 | exact candidate `git diff --check`              | Passed | `c64e42d6..f7d5d43f` contains no whitespace error.                                                   |
| V19 | prohibited implementation/dependency searches   | Passed | No deferred mutations, service/chat dependencies, or prohibited-scope paths.                         |
| V20 | `node scripts/validate-phase.mjs P004`          | Passed | Phase and pending review/disposition/QA note structure valid.                                        |

Test totals are 17 shared, 8 database, 43 API, 24 component, and 4 Playwright:
96 passing tests across all required layers.

## Direct Probe Details

- Internal offset 1 returned seeded internal comment ID; the same client-role
  request returned count 0 and contained neither the ID nor internal content.
- Client internal-only create returned `403`; missing and cross-tenant request
  IDs both returned `404`; allowed shared create returned `201`.
- Direct SQL invalid body returned `23514`.
- Request status, estimate status, and status-history count were byte-for-byte
  stable across comment creation.
- Two simultaneous valid creates returned `[201, 201]`.
- Captured logs omitted unique internal body, authorization, cookie, and
  database-URL sentinels and rendered `x-dev-user-id` as `[Redacted]`.

## Interim Results

- Initial strict typecheck found one insufficiently discriminated repository
  result union; the corrected authoritative run passed.
- Sandbox-only Docker, IPC, and localhost denials were rerun with approved local
  access and passed.
- An API assertion was corrected to preserve the existing distinction between
  tenant-membership denial (`404`) and global-user authentication denial
  (`401`).
- Three new Playwright iterations corrected readiness and locator assumptions;
  no runtime implementation defect was found, and the final 4-test run passed.
- Initial lint found formatting only in generated Drizzle JSON and the newest
  test; formatting was normalized and the final run passed.
- An initial broad prohibited-scope search matched fixture table names in test
  reset SQL; runtime and changed-path searches passed.

## Known Limitations And Non-Goals

- Independent Claude review, finding disposition, and human Q1-Q10 QA have not
  run. P004 is not complete and must not be integrated yet.
- The implementation remains local-only with development authentication.
- No real-time transport, threading, edit/delete, rich text, moderation,
  attachments, notification delivery/outbox, time tracking, production auth,
  AWS, billing, queues, or background jobs was added.
- Comments remain available for every active request status by approved design;
  they never transition request or estimate state.

## Independent Review Focus

- Challenge the repository visibility predicate and pagination/count metadata
  for every client-oracle edge, including exact-full pages and arbitrary
  offsets.
- Recheck the create transaction's active membership/capability lock and its
  behavior during concurrent membership suspension.
- Verify historical author joins never require current author membership and
  expose only safe display names.
- Confirm no comment mutation reaches P003 request/estimate/response/history
  state, including revision submission after clarification.
- Inspect safe-default reset, identity-scoped cache invalidation, client
  artifact absence, focus/announcement behavior, long wrapping, and narrow
  layout.
- Verify the index replacement and body constraint are additive for the
  authoritative pre-P004 data and match the Drizzle snapshot.

## Completion Status

- Candidate implementation and all automated validation are complete.
- Independent review, human finding disposition, and Q1-Q10 QA remain pending.
- Phase status is `review_pending`; Codex has not marked P004 complete.
