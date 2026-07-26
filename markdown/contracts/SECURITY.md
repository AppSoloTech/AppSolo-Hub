# Security Contract

## Security Goal

P001/P002 establish defaults that prevent accidental cross-tenant disclosure, development-auth leakage into production, invitation-token exposure, secret exposure, and unsafe error handling.

It is not a claim of production security readiness. Production hardening remains P011.

## Trust Boundaries

- Browser input is untrusted.
- Route IDs and headers are untrusted.
- Frontend role checks are untrusted for authorization.
- Development auth headers are trusted only after the environment guard and database user lookup.
- Database rows must be scoped by an authorized tenant/project path.
- AWS does not exist in the P001 trust model.

## Authentication

- Modules consume `AuthenticatedUser`, not provider claims.
- Development middleware is available only in `development` and `test`.
- Production startup fails if development auth is enabled.
- The middleware loads the user and verifies active status.
- Missing or unknown simulated users produce `401` without disclosing sensitive detail.
- Cognito JWT verification is deferred to P008.
- P002's email-only sign-in is an explicitly insecure local identity selector. It stores only the selected development user ID in browser storage and creates no password, cookie, refresh token, or production credential.
- Invitation acceptance uses possession of at least 256 bits of random token material. Only its SHA-256 hash is persisted.
- Acceptance tokens travel from the local link fragment to one strict JSON body. The browser removes the fragment from history immediately and never stores the token.
- Invitation create/resend records the authorizing administrator role with the
  token hash. Acceptance enforces the proposed role and any current suspended
  target membership role against that snapshot, rather than requiring the
  issuing administrator to remain active. An authorized resend replaces the
  snapshot with the resending administrator's current identity and role.

## Authorization

For every project or request operation:

1. establish an authenticated active user;
2. resolve the project's client organization;
3. verify organization and project are active;
4. verify an `ACTIVE` membership and allowed capability;
5. execute a query scoped to the authorized organization/project;
6. return no row data when authorization fails.

P001 must test an authenticated user from another client tenant. Hiding UI navigation is not evidence.

P002 access administration repeats tenant and capability checks in services/repositories for every collection and mutation. Role ceilings are centralized, membership state changes are optimistic/serialized, and self-suspension/last-owner lockout are conflicts. Suspended memberships lose tenant capabilities immediately; globally suspended users cannot authenticate.

P003 adds centralized `VIEW_ESTIMATES`, `MANAGE_ESTIMATES`, and
`RESPOND_TO_ESTIMATES` capabilities. Every estimate read and write resolves the
request through its active project/client organization and active membership.
Draft rows are omitted at the repository query for client roles, not merely
hidden in React. Estimate identifier mutations recheck tenant membership,
capability, lifecycle state, and optimistic timestamps under transaction locks.

## Input And Output

- Zod validates all params, query values, and write bodies.
- Database constraints remain enabled.
- Unknown write fields should be rejected.
- Output DTOs are explicit; do not serialize arbitrary database rows.
- Stack traces, raw SQL/driver errors, and configuration are never returned.
- Error details may include safe field-level validation issues only.

## Secrets And Configuration

- `.env` files are ignored.
- `.env.example` files contain only local-safe examples.
- `VITE_` variables are treated as public.
- Database URLs, passwords, auth headers, cookies, and future tokens are redacted.
- Invitation tokens, token hashes, acceptance URLs, development sign-in bodies, and access-change bodies are not logged.
- No AWS keys are created or stored.

## Logging

- Structured logs include request ID and useful operational context.
- Do not log full request bodies by default. P002 explicitly redacts `req.body`.
- Estimate scope, response notes, hours, rates, and monetary write bodies remain
  covered by whole-body redaction.
- Do not log comment bodies, attachment content, authorization headers, cookies, or database URLs.
- Internal errors may include stack traces in local logs, but never in client responses.
- Authentication failures should avoid exposing whether another tenant resource exists beyond the agreed status behavior.

## HTTP Baseline

P001 should include:

- explicit CORS configuration;
- common security headers through a small maintained middleware such as Helmet;
- JSON body size limits;
- disabled Express identifying header when practical;
- centralized 404 and error behavior.

Rate limiting, CSRF strategy, Content Security Policy tuning, secure cookies, and proxy trust require the eventual production authentication and hosting model and are deferred.

## Database

- Use Drizzle parameterization; no string-built SQL from user input.
- Use a least-privilege application database user in production later.
- Do not automatically run destructive migrations at application startup.
- Test and development databases are separate.
- No hard-delete endpoints exist in P001.
- Invitations, memberships, and access-audit events have no hard-delete API. Access audit rows have no update API.
- Estimates and immutable estimate responses have no hard-delete API.
- Exact stored cost is protected by a PostgreSQL rounded-product check.

## Attachments

P001 defines metadata and a storage interface only.

It must not:

- accept multipart or binary upload routes;
- write local user files as a production design;
- import AWS SDK packages;
- trust filename, MIME type, or storage key from a client as authoritative.

## Deferred Security Work

- Cognito token validation and session strategy;
- S3 signed URL and malware/content controls;
- SES abuse and delivery controls;
- rate limiting and bot protection;
- RDS networking and encryption configuration;
- IAM least privilege and OIDC trust;
- backup/restore and retention;
- formal dependency and container scanning;
- production penetration and accessibility/security QA.
