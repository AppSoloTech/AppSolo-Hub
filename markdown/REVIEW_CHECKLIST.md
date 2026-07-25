# Independent Review Checklist

Claude should use this checklist with the active prompt. It is not a substitute for reviewing the exact diff.

## Review Boundary And Evidence

- [ ] Base SHA and candidate SHA exist and match the handoff.
- [ ] The reviewed diff contains only phase work.
- [ ] The working tree does not contain required candidate behavior absent from the commit.
- [ ] Validation commands are real, not no-op placeholders.
- [ ] Failed and unrun checks are reported honestly.

## Scope And Product Alignment

- [ ] Every requirement and acceptance criterion has evidence.
- [ ] Non-goals were not pulled into the implementation.
- [ ] No AWS resource, SDK, production auth, billing, or attachment upload work entered P001.
- [ ] The dashboard remains clear and appropriately simple.
- [ ] No unrelated refactor obscures the phase diff.

## Monorepo And TypeScript

- [ ] pnpm workspace boundaries are understandable.
- [ ] Root scripts invoke meaningful package scripts.
- [ ] Strict TypeScript is enabled across packages.
- [ ] `any`, unsafe assertions, and duplicated DTO types are absent or justified.
- [ ] Shared code does not import application- or platform-specific modules.
- [ ] Package dependencies flow in the documented direction.

## Authentication And Tenant Authorization

- [ ] Middleware creates the provider-neutral `AuthenticatedUser` contract.
- [ ] Development auth cannot run in production.
- [ ] User-supplied development identity is not trusted outside development/test.
- [ ] Active user, membership, organization, and project conditions are enforced.
- [ ] List, detail, and create routes all enforce access.
- [ ] Repositories receive or apply authorized scope as defense in depth.
- [ ] Unauthorized requests return no resource data.
- [ ] Tests use at least two tenants/users and prove denial, not merely missing UI links.

## Database And Migrations

- [ ] UUID keys, foreign keys, uniqueness, checks, timestamps, and indexes match the data contract.
- [ ] Currency uses exact numeric storage and decimal strings, not floating-point arithmetic.
- [ ] Initial status-history creation is transactional with change-request creation.
- [ ] Development and test databases are isolated.
- [ ] Migrations are explicit and non-destructive.
- [ ] Seed data is realistic, deterministic enough for tests, and clearly fake.
- [ ] No application startup path silently mutates production schema.

## API

- [ ] All external input is parsed by Zod at the boundary.
- [ ] Success and error envelopes match the API contract.
- [ ] Error codes and HTTP statuses are consistent.
- [ ] Stack traces, SQL details, environment values, and secrets are not returned.
- [ ] Health behavior distinguishes API and database readiness.
- [ ] List ordering and pagination metadata are deterministic.
- [ ] Controllers are thin; services own authorization and use-case logic.
- [ ] Database code is isolated from controllers.
- [ ] Request IDs and structured logs are present.

## Logging And Security

- [ ] Logs redact authorization, cookies, credentials, and database URLs.
- [ ] Unknown errors are logged internally and returned generically.
- [ ] CORS is explicit and environment-driven.
- [ ] Security middleware does not break local use or leak details.
- [ ] Request size limits exist.
- [ ] No real credentials are committed.
- [ ] `.env.example` files contain safe values and explain public `VITE_` variables.

## Frontend

- [ ] React Router routes list, detail, and create behavior coherently.
- [ ] TanStack Query owns server-state loading and invalidation.
- [ ] React Hook Form uses shared Zod validation.
- [ ] Loading, empty, success, validation, not-found/forbidden, and generic error states are visible and understandable.
- [ ] Submitting prevents duplicate actions and gives success feedback.
- [ ] The saved request remains after refresh because it came from PostgreSQL.
- [ ] The sidebar, brand, organization indicator, and project context are present.
- [ ] CSS Modules/design tokens are maintainable without a large UI framework.
- [ ] Labels, focus behavior, keyboard use, heading order, and error association support basic accessibility.

## Testing

- [ ] Health endpoint test checks database behavior where applicable.
- [ ] Environment validation includes valid and invalid cases.
- [ ] Shared change-request schema tests meaningful boundaries.
- [ ] API create test verifies persisted database state.
- [ ] Unauthorized access test proves tenant denial.
- [ ] List test verifies only authorized project data and deterministic ordering.
- [ ] Frontend form test follows user-observable behavior.
- [ ] Playwright smoke test exercises the assembled frontend-to-API path.
- [ ] Tests do not depend on production or AWS services.

## Maintainability

- [ ] No speculative base repository/service framework was added.
- [ ] Functions and modules have focused responsibilities.
- [ ] Errors are not silently swallowed.
- [ ] Comments explain non-obvious decisions rather than restating code.
- [ ] Contracts and README match actual behavior.
