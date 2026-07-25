# Architecture

## Architectural Goal

Create a production-quality TypeScript PERN application that is easy for a small team to understand, runs fully locally, enforces tenant access in the API, and can later adopt AWS services through explicit integration boundaries.

## System Context

```text
Authorized browser user
        |
        | HTTPS / JSON REST
        v
React web application
        |
        | /api/v1
        v
Express API
        |
        | service authorization + Drizzle queries
        v
PostgreSQL
```

P001 uses local HTTP and Docker Compose. The future production topology may replace hosting and authentication components without changing domain modules.

## Repository Boundaries

```text
apps/web
  Browser application, routing, query state, forms, presentation.

apps/api
  HTTP composition, middleware, controllers, services, repositories,
  authorization, logging, and errors.

packages/shared
  Runtime-safe Zod schemas, enums, request/response DTOs, and shared types.
  It must not import browser-only, Express-only, database-driver, or AWS code.

packages/database
  PostgreSQL client construction, Drizzle schema, migrations, and seed logic.
  It must not import controllers or frontend code.

e2e
  Playwright tests that exercise the assembled local system.

markdown / prompts / notes
  Durable product truth, work orders, and execution evidence.
```

## Dependency Direction

```text
apps/web ----------> packages/shared
apps/api ----------> packages/shared
apps/api ----------> packages/database
packages/database --> packages/shared only when a shared enum/schema is safe
```

Do not create circular package dependencies. Database row types are not automatically public API DTOs.

## Backend Composition

Recommended initial shape:

```text
apps/api/src/
├── app.ts
├── server.ts
├── config/
├── errors/
├── logging/
├── middleware/
├── modules/
│   ├── health/
│   └── change-requests/
│       ├── change-request.routes.ts
│       ├── change-request.controller.ts
│       ├── change-request.service.ts
│       └── change-request.repository.ts
└── types/
```

### Controllers

Controllers translate HTTP details into typed service calls and typed responses. They remain thin and do not contain tenant rules or direct SQL.

### Services

Services own use-case logic, authorization decisions, status defaults, transactions, and mapping business failures to application errors.

### Repositories

Repositories isolate Drizzle queries. Methods accept the scope needed to prevent accidental cross-tenant queries. They do not infer authorization from frontend input.

### Middleware

Middleware constructs request IDs, logging context, parsed authentication context, validation failures, and centralized errors.

## Frontend Composition

Recommended initial shape:

```text
apps/web/src/
├── app/
├── components/
├── features/change-requests/
├── layouts/
├── lib/
├── routes/
└── styles/
```

Feature code may contain route components, queries, forms, and presentation components for one domain area. Cross-feature abstractions should be created only when reuse is real.

## Request Flow

### List Requests

1. React requests `/api/v1/projects/:projectId/change-requests` and includes development auth context.
2. Authentication middleware produces `AuthenticatedUser`.
3. Route validation parses path and query parameters.
4. The service verifies active access to the project's organization.
5. The repository executes a project- and organization-scoped query.
6. The controller returns `{ data, meta }`.
7. React renders loading, empty, success, or error state.

### Create Request

1. React Hook Form uses the shared Zod input schema.
2. The API parses the same external contract independently.
3. The service verifies access and applies server-owned fields.
4. A transaction inserts the change request and initial status-history row.
5. The API returns the created DTO.
6. TanStack Query updates or invalidates list/detail data.
7. The user sees a clear success result and the persisted request.

## Multi-Tenant Ownership Model

- A `CLIENT` organization is the tenant that owns a project.
- `Project.organizationId` is the root tenant key for project descendants.
- Users gain scoped access through active `OrganizationMembership` rows.
- AppSolo internal users belong to the `INTERNAL` AppSolo organization and may also receive a role-bearing membership in a client organization when they need access to that tenant.
- P001 does not add a second speculative project-assignment model.
- Service authorization checks active user, organization, membership, and project status.
- Repository calls include the authorized organization/project scope as defense in depth.
- PostgreSQL row-level security is deferred; application-layer enforcement is mandatory and tested.

## Authentication Abstraction

Application modules receive:

```ts
interface AuthenticatedUser {
  userId: string;
  email: string;
}
```

P001 uses development-only middleware to create this context from a configured user ID or development header. Cognito claim parsing will later be isolated in an authentication adapter. Business modules must not read Cognito-specific claims.

The API must refuse to start in production if development authentication is enabled.

## API Contract

- Versioned routes under `/api/v1`.
- JSON success shape: `{ "data": ..., "meta": ... }`.
- JSON error shape: `{ "error": { "code", "message", "details" } }`.
- Request IDs are returned and logged.
- Stack traces, raw SQL errors, and secrets are never returned.
- Shared runtime schemas validate external payloads; TypeScript types alone are insufficient.

See `contracts/API.md`.

## Data Architecture

- PostgreSQL is the system of record.
- Drizzle owns schema definitions and migrations.
- Migrations are explicit and non-destructive by default.
- UUID primary keys and `timestamptz` timestamps are used consistently.
- Money uses PostgreSQL `numeric` and decimal strings at JavaScript/API boundaries.
- A development seed creates realistic, clearly fake tenant data.
- Development and test databases are isolated.

See `contracts/DATA_MODEL.md`.

## Logging And Errors

- Pino provides structured JSON logging.
- A request-scoped logger includes request ID, method, route, status, duration, and authenticated user ID when available.
- Authorization headers, cookies, database URLs, request bodies containing sensitive data, and stack traces are redacted from normal logs.
- Known application errors map to stable codes and HTTP statuses.
- Unknown errors are logged with internal context and returned as generic `INTERNAL_ERROR`.

## Styling Decision

P001 uses global design tokens and CSS Modules. This avoids a large component framework while providing local styles and a consistent dashboard shell.

## Future AWS Integration Points

- Web build -> AWS Amplify Hosting.
- API container -> ECR and ECS Express Mode or Fargate.
- PostgreSQL -> RDS for PostgreSQL.
- Authentication adapter -> Cognito JWT validation.
- `AttachmentStorage` implementation -> S3.
- runtime secrets -> Secrets Manager.
- logs/metrics -> CloudWatch.
- email adapter -> SES.
- deployment identity -> GitHub Actions with AWS OIDC.

No AWS-specific package belongs in P001.

## Architectural Non-Goals For P001

- microservices;
- event buses;
- CQRS or event sourcing;
- repository base classes;
- generic service frameworks;
- GraphQL;
- row-level security;
- distributed caching;
- background workers;
- production containers or cloud infrastructure;
- billing or payment architecture.
