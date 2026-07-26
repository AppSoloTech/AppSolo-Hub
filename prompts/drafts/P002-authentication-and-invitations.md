---
phase: P002
spec_version: 1
status: draft
approved_by: null
approved_date: null
drafted_date: 2026-07-26
last_verified_sha: ccf344a406085a92669d867cc068e67c55519af3
---

# P002 — Authentication And Invitations

> This is a non-authorizing draft. Implementation must not begin until the human approves a consolidated revision, the prompt is moved to `prompts/active/`, and the canonical P002 phase record becomes `approved`.

## Problem

P001 proves an authorized browser-to-database change-request flow, but identity selection is still a build-time development value or an untrusted development header. The product has no user-facing session state, invitation lifecycle, membership administration, capability policy, or durable access-change history.

The existing `users` and `organization_memberships` tables provide a foundation, but:

- membership rows have no active/suspended lifecycle;
- invitation behavior and token security are undefined;
- role-management boundaries are not centralized;
- client administrators cannot manage their organization's members;
- the web application cannot sign in, sign out, accept an invitation, or show the current identity;
- P001 authorization queries cannot distinguish an active membership from a suspended one;
- access changes do not leave an immutable audit record.

P002 must close those local product gaps while preserving the provider-neutral authentication boundary. It must not implement Cognito, SES, AWS infrastructure, or production authentication.

## Outcome

On a fully local stack:

1. an authorized organization administrator can view members and invitations;
2. the administrator can create, resend, and revoke an invitation within an explicit role ceiling;
3. a bearer of a valid invitation token can accept once, activating the invited user and membership atomically;
4. authorized administrators can change allowed roles and suspend or reactivate memberships without hard deletion or tenant leakage;
5. access changes create immutable, tenant-scoped audit events;
6. the browser has a clearly labeled development-only sign-in/session experience that consumes a provider-neutral session DTO;
7. suspended or unauthorized memberships lose project and access-administration capabilities immediately;
8. all P001 change-request behavior continues to work for active authorized memberships.

## Current Repository Evidence

- Basis SHA: `ccf344a406085a92669d867cc068e67c55519af3` on local `main`.
- P001 status: complete, reviewed, human-QA passed, and locally integrated.
- Authentication middleware already produces `AuthenticatedUser { userId, email }` after an active database-user lookup.
- The API refuses production startup when development authentication is enabled.
- `users.status` already supports `INVITED`, `ACTIVE`, and `SUSPENDED`.
- `organization_memberships` is unique on `(user_id, organization_id)` but has no lifecycle status.
- Organization access is explicit; membership in the internal AppSolo organization does not grant global client access.
- The web API client currently sends `VITE_DEV_AUTH_USER_ID` directly and has no session provider.
- No AWS SDK, email adapter, production token verifier, session cookie, or invitation table exists.

Codex must revalidate every claim and record a new base SHA before implementation.

## Requirements

### R1 — Preserve And Clarify The Authentication Boundary

- Business modules continue to consume only the provider-neutral `AuthenticatedUser`.
- Extract request authentication behind a focused application adapter/composition boundary where useful; do not pass raw development headers or future provider claims into services.
- Keep development authentication available only in `development` and `test`.
- Keep production startup failure when development authentication is enabled.
- Add an authenticated `GET /api/v1/session` contract that returns the current application user, active organization memberships, roles, and capabilities.
- Add a clearly labeled development-only sign-in mechanism that resolves an active local user by normalized email and establishes only browser-side development identity state.
- Development sign-in must not be described as secure or production-ready authentication.

### R2 — Add A Secure Invitation Data And Token Lifecycle

- Add an additive organization-invitation model with organization, invited user/email, proposed role, inviter, status, token hash, expiry, acceptance/revocation timestamps, resend metadata, and timestamps.
- Store invitation status as `PENDING`, `ACCEPTED`, or `REVOKED`; derive the effective `EXPIRED` presentation state when a pending invitation is past `expiresAt` so no background job is required.
- Generate at least 256 bits of cryptographically secure random token material.
- Persist only a SHA-256 or stronger one-way token hash; never persist or log plaintext invitation tokens.
- A create or resend response may return one local acceptance URL exactly once to the authorized caller.
- The local acceptance URL carries the token in the URL fragment so normal HTTP requests do not send it as a path or query value.
- A pending invitation expires seven days after creation or resend.
- Resend rotates the token, invalidates the prior token, resets expiry, and increments resend metadata.
- Revoke invalidates a pending invitation.
- Enforce at most one pending invitation per normalized email and organization.

### R3 — Implement Tenant-Scoped Invitation Administration

- Authorized administrators can list, create, resend, and revoke invitations only in an active organization where they hold an active membership with the required capability.
- Invitation inputs use strict shared schemas and normalized lowercase email.
- Creating an invitation for a new email creates an `INVITED` user using the supplied first and last name.
- Creating an invitation for an existing active user reuses that user without overwriting their profile.
- A globally suspended user cannot be invited or silently reactivated.
- Existing active membership, duplicate pending invitation, invalid role assignment, inactive organization, and stale invitation state produce stable safe errors.
- Organization/invitation authorization and queries remain tenant-scoped in the service/repository path.

### R4 — Implement Atomic Invitation Acceptance

- `POST /api/v1/invitations/accept` is reachable without an existing authenticated session and accepts the token only in the JSON body.
- Acceptance validates the hashed token, pending state, expiry, organization state, user state, and role constraints.
- One transaction:
  - activates a newly invited user;
  - creates or reactivates the organization membership with the invited role;
  - marks the invitation accepted;
  - records the acceptance audit event.
- The token is single-use. Concurrent or repeated acceptance cannot create duplicate memberships or multiple success results.
- Expired tokens return a stable `INVITATION_EXPIRED` error. Invalid, revoked, rotated, or previously accepted tokens return one generic `INVITATION_INVALID` error.
- Successful local acceptance returns the provider-neutral user/session data needed for the development browser to continue as that user; it does not create a production credential.

### R5 — Add Centralized Capabilities And Membership Administration

- Add a typed capability policy used by services and exposed through session/member DTOs.
- Update every P001 organization-membership authorization query to require membership status `ACTIVE`.
- Add tenant-scoped member listing with deterministic ordering and safe pagination.
- Add role-change, suspension, and reactivation behavior without hard deletion.
- Reject self-suspension and any operation that would leave an organization without an active `OWNER`.
- Role changes and status changes use optimistic state checks or equivalent conflict handling so stale operations cannot silently overwrite newer access state.
- Globally suspended users cannot authenticate even if a membership remains active.
- A suspended membership immediately removes project/change-request and access-administration capabilities for that organization.

### R6 — Enforce The Proposed Role-Management Ceiling

For an active membership in the target organization:

| Actor role      | View members | Manage invitations | Assign/manage roles                                            |
| --------------- | ------------ | ------------------ | -------------------------------------------------------------- |
| `OWNER`         | yes          | yes                | `OWNER`, `ADMIN`, `DEVELOPER`, `CLIENT_ADMIN`, `CLIENT_MEMBER` |
| `ADMIN`         | yes          | yes                | `DEVELOPER`, `CLIENT_ADMIN`, `CLIENT_MEMBER`                   |
| `CLIENT_ADMIN`  | yes          | yes                | `CLIENT_MEMBER` only                                           |
| `DEVELOPER`     | no           | no                 | none                                                           |
| `CLIENT_MEMBER` | no           | no                 | none                                                           |

Additional rules:

- internal organizations allow only `OWNER`, `ADMIN`, and `DEVELOPER`;
- client organizations may contain client roles and explicitly assigned internal service roles, preserving ADR-0003;
- no internal-organization membership grants access to another organization;
- an actor cannot assign a role above the table's ceiling through create, resend, acceptance, or membership update;
- an invitation's role cannot be changed by resend; revoke and create a new invitation instead;
- every server route checks capabilities independently of the React UI.

### R7 — Record Immutable Access Audit Events

- Add an immutable, organization-scoped access-audit table.
- Record at least:
  - `INVITATION_CREATED`;
  - `INVITATION_RESENT`;
  - `INVITATION_REVOKED`;
  - `INVITATION_ACCEPTED`;
  - `MEMBERSHIP_ROLE_CHANGED`;
  - `MEMBERSHIP_SUSPENDED`;
  - `MEMBERSHIP_REACTIVATED`.
- Each event records the organization, actor when available, subject user, related invitation/membership when applicable, prior/new role or status when applicable, and timestamp.
- Audit events are written in the same transaction as the access change.
- Audit events never contain plaintext tokens, token hashes, credentials, request bodies, or arbitrary sensitive metadata.
- Authorized member administrators can list events with deterministic newest-first ordering and pagination.
- Audit events have no update or delete API.

### R8 — Add Explicit API Contracts

Implement and document:

- `POST /api/v1/development/session` — development/test only, normalized email sign-in;
- `GET /api/v1/session` — current user, memberships, and capabilities;
- `GET /api/v1/organizations/:organizationId/members`;
- `PATCH /api/v1/organizations/:organizationId/memberships/:membershipId`;
- `GET /api/v1/organizations/:organizationId/invitations`;
- `POST /api/v1/organizations/:organizationId/invitations`;
- `POST /api/v1/organizations/:organizationId/invitations/:invitationId/resend`;
- `POST /api/v1/organizations/:organizationId/invitations/:invitationId/revoke`;
- `POST /api/v1/invitations/accept`;
- `GET /api/v1/organizations/:organizationId/access-events`.

Contract rules:

- preserve `/api/v1`, success envelopes, error envelopes, and request IDs;
- add stable `INVITATION_INVALID` (`400`) and `INVITATION_EXPIRED` (`410`) errors;
- use `409 CONFLICT` for duplicate/stale state and last-owner protection;
- use `403 FORBIDDEN` for unauthorized organization collection/actions;
- return `404 NOT_FOUND` for inaccessible membership/invitation identifiers when disclosing existence would create a tenant oracle;
- reject unknown write fields;
- never serialize raw database rows or token hashes;
- do not log sign-in email bodies, invitation tokens, acceptance URLs, or access-change request bodies.

### R9 — Deliver The Local Session And Access UI

- Replace the hard-coded browser identity header path with a small session provider/API client boundary.
- Provide a clearly labeled local-development sign-in screen using email only.
- Persist only the selected development user ID in browser storage; never persist invitation tokens after acceptance.
- Provide sign-out and current-user/organization context.
- Add an access-management area for authorized roles with:
  - member list and active/suspended state;
  - invitation list and effective pending/expired/accepted/revoked state;
  - create invitation form;
  - copy-once local acceptance link feedback;
  - resend and revoke actions;
  - allowed role/status changes;
  - access audit history.
- Add an invitation-acceptance route that reads the token from the URL fragment, removes it from browser history/state promptly, posts it in the JSON body, and displays success, expired, invalid, and retryable failure states.
- Hide unavailable actions according to returned capabilities, while retaining API authorization as the only security boundary.
- Preserve accessible labels, keyboard operation, focus management, loading/empty/error/success states, and narrow-viewport usability.
- Preserve the P001 change-request list/detail/create experience for active authorized users.

### R10 — Migrations, Seed, Documentation, And Evidence

- Use additive checked-in Drizzle migrations and matching snapshots.
- Add a membership-status enum/column with existing rows migrated to `ACTIVE`.
- Add invitation and access-audit tables, constraints, indexes, and foreign keys.
- Keep hard deletes out of the API and default foreign-key behavior to `RESTRICT`.
- Extend fake seed data with deterministic invitation/membership/audit scenarios needed for tests and human QA without embedding a usable secret in source control.
- Keep development and test databases isolated and destructive reset guards intact.
- Update API, data, security, environment, integration, testing, architecture, README, and accepted ADR documentation where behavior changes.
- Add meaningful shared, database, API integration, React component, and Playwright coverage.
- Create an immutable candidate commit and `notes/P002/implementation-handoff.md`.
- Advance the canonical P002 record only through the normal review lifecycle; Codex must not mark P002 complete.

## Acceptance Criteria

- AC1 maps to R1: authenticated requests produce the unchanged provider-neutral `AuthenticatedUser`; production still rejects development auth.
- AC2 maps to R1: development sign-in by active normalized email establishes browser development identity, while unknown/invited/suspended users receive a safe denial.
- AC3 maps to R1/R8: `GET /session` returns explicit user, active memberships, roles, and capabilities without provider claims or raw rows.
- AC4 maps to R2: stored invitation records contain only a one-way token hash; plaintext token and acceptance URL appear only in the authorized create/resend response.
- AC5 maps to R2: invitation expiry is seven days; resend rotates the token and invalidates the prior token; revoke invalidates the current token.
- AC6 maps to R2/R3: duplicate pending invitations for the same normalized email and organization cannot be created, including concurrent attempts.
- AC7 maps to R3/R6: owner, admin, and client-admin invitation actions obey the exact role ceiling; developer/client-member and cross-tenant attempts are denied.
- AC8 maps to R3: new invitees are `INVITED`; existing active users are reused; suspended users are not silently reactivated.
- AC9 maps to R4: valid acceptance atomically activates the user, creates/reactivates membership, accepts the invitation, and records one audit event.
- AC10 maps to R4: expired tokens return `410 INVITATION_EXPIRED`; invalid/revoked/rotated/used tokens return `400 INVITATION_INVALID`.
- AC11 maps to R4: repeated or concurrent acceptance produces at most one success and one membership.
- AC12 maps to R5: every existing change-request authorization query requires an active membership, and suspension removes access immediately.
- AC13 maps to R5/R6: membership role/status changes enforce capability ceilings, reject self-suspension, and protect the last active owner.
- AC14 maps to R5: reactivation restores only the capabilities granted by the membership's current role.
- AC15 maps to R7: every invitation/membership mutation writes one immutable tenant-scoped audit event in the same transaction.
- AC16 maps to R7: audit listing is authorized, newest-first, paginated, explicit, and contains no token, credential, or arbitrary request-body data.
- AC17 maps to R8: all listed routes validate params/query/body with strict Zod schemas and use the standard envelopes/request correlation.
- AC18 maps to R8: inaccessible resource identifiers do not create cross-tenant existence or state oracles.
- AC19 maps to R9: the browser supports development sign-in/out, session context, invitation management, acceptance, membership updates, and audit viewing through observable states.
- AC20 maps to R9: invitation tokens are removed from browser-visible history/state after capture and are never stored in local storage.
- AC21 maps to R9: UI capability hiding and API denial are both proven; hiding controls alone is not accepted as authorization evidence.
- AC22 maps to R9: active P001 users can still list, view, create, and refresh change requests.
- AC23 maps to R10: additive migrations apply to existing P001 data, existing memberships become active, seed is idempotent, and Drizzle generation reports no drift.
- AC24 maps to R10: isolated API/component/browser tests cover success, denial, concurrency/stale state, token lifecycle, redaction, and P001 regression behavior.
- AC25 maps to R10: contracts, phase evidence, exact SHAs, validation results, and handoff are complete, with no AWS or production-auth work.

## Proposed Binding Decisions

These become binding only if the human approves this prompt revision.

1. **Invitation lifetime:** seven days from create or resend.
2. **Resend behavior:** rotate the existing invitation's token and expiry; do not create multiple pending invitation rows.
3. **Local delivery:** authorized admins copy a one-time local acceptance URL. No email adapter or simulated email outbox enters P002.
4. **Token transport:** the browser receives the token in a URL fragment and sends it to the API only in a JSON acceptance body.
5. **User creation:** invitation creation requires first name, last name, email, and role; a new user is created as `INVITED`.
6. **Acceptance proof:** possession of the high-entropy invitation token is the acceptance credential. P008 later binds production identity through Cognito.
7. **Membership lifecycle:** membership rows are suspended/reactivated, never hard-deleted.
8. **Role ceiling:** use the exact table in R6, including client administrators managing client members only.
9. **Lockout protection:** self-suspension and removal/demotion of the last active owner are conflicts.
10. **Development session:** local email sign-in remains an explicitly insecure development adapter backed by the existing database user record and browser development identity.
11. **No project-membership model:** organization membership remains the authorization root.
12. **Audit retention:** access audit rows are immutable and have no deletion endpoint.
13. **Expiration state:** store pending/accepted/revoked lifecycle state and derive expiration from `expiresAt`; do not add a scheduler merely to update invitation rows.

## Suggested Approach

Non-binding implementation direction:

- create focused `session`, `access`, and `invitations` API modules rather than expanding the change-request repository;
- centralize capability evaluation in a typed policy module shared by access and change-request services;
- expose application-owned session, member, invitation, and audit DTOs from `packages/shared`;
- use Node's built-in `crypto.randomBytes`, `createHash`, and UUID support instead of a token dependency;
- pass a clock/token generator into invitation services for deterministic tests;
- keep public health, development-session, and invitation-acceptance routes explicitly separated from authenticated routers;
- use transactions and conditional updates to make acceptance and stale membership changes concurrency-safe;
- keep the React session provider small and avoid introducing a general state-management framework;
- retain TanStack Query for server state and React Hook Form/Zod for forms.

Codex must inspect current code and may choose a simpler implementation that satisfies every binding requirement and criterion.

## Invariants

- Provider claims never enter business modules.
- Development authentication cannot run in production.
- Active user and active organization membership are required for tenant access.
- Internal AppSolo membership alone grants no client-tenant access.
- Services own capability decisions; repositories execute scoped queries.
- Frontend state and hidden controls are never authorization evidence.
- P001 request behavior and tenant denial remain intact.
- Plaintext invitation tokens, token hashes, credentials, and sensitive request bodies are absent from logs.
- Test and development databases remain separate.
- Migrations are additive and non-destructive by default.
- No hard-delete access APIs are introduced.
- No AWS service is required for local development.
- Strict TypeScript remains enabled; avoid `any` and unjustified assertions.

## Non-Goals

- NG1: Amazon Cognito, JWT verification, hosted UI, OAuth/OIDC, MFA, or production login.
- NG2: SES, email delivery, templates, preferences, digests, or an email outbox.
- NG3: AWS SDK packages, infrastructure, deployment, Secrets Manager, CloudWatch, RDS, ECS, or Amplify work.
- NG4: Password storage, password reset, account recovery, secure production cookies, or refresh tokens.
- NG5: Project-specific memberships, global internal-admin bypasses, or PostgreSQL row-level security.
- NG6: Organization/project creation or deletion.
- NG7: User hard deletion, membership hard deletion, or audit-event deletion.
- NG8: Estimate, approval, comment, time, attachment, notification, or billing workflows.
- NG9: General-purpose RBAC frameworks, policy engines, microservices, event buses, or background workers.
- NG10: Rate limiting/bot protection beyond preserving safe extension points for P011.
- NG11: Invitation email enumeration endpoints or public user directories.
- NG12: Redesigning the entire P001 dashboard outside the session/access-management needs.

## Likely Affected Areas

- `packages/database`: membership lifecycle, invitations, access audit, migrations, seed.
- `packages/shared`: capabilities, inputs, DTOs, errors/enums.
- `apps/api`: authentication adapter composition, session, invitation, access policy/service/repository/routes, logging/redaction.
- `apps/web`: session provider, sign-in/out, invitation acceptance, access-management UI, navigation.
- `e2e`: invitation/session/member lifecycle and P001 regression smoke.
- `markdown/contracts`, `markdown/decisions`, `README.md`, `notes/P002`, and the P002 phase record.

## Data And Migration Impact

- Schema change: additive membership-status enum/column plus invitation and access-audit tables.
- Existing data: every existing membership becomes `ACTIVE`; users and P001 rows remain unchanged.
- Backward compatibility: P001 access remains available to current active seeded memberships.
- Migration safety: checked-in SQL only; no reset/push against shared data.
- Rollback/recovery: no destructive down migration. Before any non-local use, use a database backup or restore point; local recovery may use guarded reset.
- Seed/test data: add clearly fake, deterministic lifecycle fixtures without a committed plaintext bearer token.

## Dependencies And Environment

- New runtime dependencies: none expected; use Node crypto and existing libraries unless revalidation proves otherwise.
- Runtime/tooling: existing Node, pnpm, Docker Compose, PostgreSQL, Vitest, Testing Library, and Playwright.
- Configuration: add a validated public web acceptance-base URL only if the runtime cannot derive it safely. Do not add invitation secrets to environment files.
- External services: none.
- Network access during tests: none.

## Automated Validation

- V1: `node scripts/check-scaffolding.mjs` passes.
- V2: `pnpm install` completes with a lockfile matching manifests and no unexplained dependency.
- V3: `pnpm docker:up` reaches healthy PostgreSQL.
- V4: `pnpm db:migrate` applies additive P002 migrations to the existing P001 development database.
- V5: `pnpm db:seed` run twice remains idempotent.
- V6: `pnpm --filter @appsolo/database test:prepare` resets only the isolated test database.
- V7: `pnpm --filter @appsolo/database generate` reports no schema drift after checked-in migrations/snapshots.
- V8: `pnpm lint` passes ESLint and Prettier.
- V9: `pnpm typecheck` passes strict checks in every workspace package.
- V10: `pnpm test` passes meaningful shared/database tests.
- V11: `pnpm test:api` passes invitation, session, capability, membership, audit, tenant-denial, concurrency/stale-state, token-redaction, and P001 regression integration tests against PostgreSQL.
- V12: `pnpm test:web` passes sign-in/session, invitation management/acceptance, member administration, capability hiding, and accessible error-state component tests.
- V13: `pnpm build` produces all package and web builds.
- V14: `pnpm test:e2e` passes a real browser/API/test-PostgreSQL invite-copy/accept/sign-in/access flow and the P001 list/create/refresh regression.
- V15: direct API probes confirm health, session identity, safe invalid/expired invitation errors, and cross-tenant denial without exposing tokens or tenant data.
- V16: a log probe confirms sign-in email bodies, invitation tokens, token hashes, acceptance URLs, credentials, and database URLs are absent.
- V17: `node scripts/generate-phase-index.mjs --check` passes.
- V18: `git diff --check <base_sha>..<candidate_sha>` passes.
- V19: repository search confirms no AWS SDK, Cognito, SES, password-auth, or production-session implementation entered the phase.
- V20: `node scripts/validate-phase.mjs P002` passes before review handoff.

Every result must be recorded as `Passed`, `Failed`, or `Not run` with exact commands and counts/reasons.

## Human QA

- Q1 — Startup/regression: follow the README on the normal development machine; confirm Docker, API, web, health, and the P001 change-request flow still work.
- Q2 — Development session: sign out, sign in by normalized active-user email, refresh, and confirm the correct user, memberships, capabilities, and tenant data appear; unknown/invited/suspended users are denied safely.
- Q3 — New-user invitation: as a Northstar owner/admin, invite a new client member, copy the one-time local link, accept it in a clean browser context, and confirm the user activates and gains only Northstar access.
- Q4 — Resend/revoke/expiry: prove an old token stops working after resend, a revoked token is invalid, and an expired token shows the specific recoverable expired state without leaking sensitive values.
- Q5 — Existing-user invitation: invite an existing active user to another authorized organization and confirm the existing profile is reused without duplicate user rows or unintended access.
- Q6 — Role ceiling and tenant denial: confirm owner/admin/client-admin controls match R6, developer/client-member controls are absent, direct unauthorized API calls fail, and neither another tenant nor internal-only membership grants access.
- Q7 — Membership lifecycle: suspend a member and confirm session/project/access routes lose that organization's capabilities immediately; reactivate and confirm only the current role's capabilities return.
- Q8 — Lockout/stale state: confirm self-suspension, last-owner removal/demotion, and a stale concurrent membership update fail safely without changing durable state.
- Q9 — Audit/redaction: confirm invitation and membership changes appear once in tenant-scoped audit history and no plaintext token, token hash, credential, or sensitive body appears in UI/API/log evidence.
- Q10 — Accessibility/responsive: use keyboard-only navigation and a narrow viewport through sign-in, invitation acceptance, member management, validation, success, and failure states.

## Deliverables

- Additive database migration and snapshot metadata.
- Provider-neutral session/capability contracts and implementation.
- Invitation, membership, and audit API modules.
- Development-only session and access-management browser UX.
- Meaningful tests across all required layers.
- Updated durable contracts, ADRs, README, and phase evidence.
- Immutable P002 candidate commit.
- `notes/P002/implementation-handoff.md` with exact base/candidate SHAs and validation evidence.

## Open Human Decisions

Before approval, explicitly approve or revise:

1. seven-day invitation expiry;
2. the R6 role-management ceiling, especially whether `CLIENT_ADMIN` may manage only `CLIENT_MEMBER`;
3. copy-only local invitation delivery with no email/outbox;
4. development email sign-in with browser-stored development user ID and no password/session cookie;
5. invitation creation requiring first name and last name before acceptance;
6. URL-fragment token delivery and JSON-body acceptance;
7. immutable access-audit retention with no deletion API;
8. derived expiration state rather than a background expiry scheduler.
