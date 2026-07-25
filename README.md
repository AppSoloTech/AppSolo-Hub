# AppSolo Client Hub

AppSolo Client Hub is a local multi-tenant portal for tracking client change requests. P001 delivers one complete, local workflow: an authorized user lists requests for a project, opens a request, submits a new one, and sees the PostgreSQL-backed result after refresh.

Tenant authorization happens in the Express API. The React UI is a convenience layer, never the authorization boundary.

## Architecture

```text
React + Vite (apps/web) -> Express /api/v1 (apps/api) -> Drizzle + PostgreSQL (packages/database)
                              ^
                       shared Zod contracts (packages/shared)
```

| Area                | Responsibility                                                           |
| ------------------- | ------------------------------------------------------------------------ |
| `apps/web`          | React Router, TanStack Query, React Hook Form, CSS Modules dashboard     |
| `apps/api`          | Express routes, development auth adapter, authorization, errors, logging |
| `packages/shared`   | Zod schemas, DTOs, enums, provider-neutral interfaces                    |
| `packages/database` | Drizzle schema, checked-in migration, local seed and guarded reset       |
| `e2e`               | Playwright seeded list/create/refresh smoke test                         |

`markdown/` is the canonical product and delivery control plane.

## Prerequisites

- Node.js `24.15.0` was verified (Node 22+ supported).
- pnpm `11.10.0` was verified; the repository pins this version.
- PostgreSQL 16-compatible server (PostgreSQL 17.9 client/server tooling was used during implementation).
- Docker Compose v2 is supported for the supplied local container setup, but Docker was not available in the implementation environment.

## Installation and local configuration

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The API loads root `.env` for local development. Use either `DATABASE_URL` or all `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` values. `APPSOLO_DB_NAME` is an optional local override when those connection components are shared with another application; it should be `appsolo_client_hub_dev` for normal development.

All `.env` files are ignored. Never commit credentials. `VITE_` values are public browser configuration and must not contain secrets.

## PostgreSQL

### Docker Compose

The supplied Compose service creates `appsolo_client_hub_dev` and `appsolo_client_hub_test` on first volume initialization.

```bash
pnpm docker:up
pnpm db:migrate
pnpm db:seed
```

### Existing local PostgreSQL instance

Create two separate databases once, then set `APPSOLO_DB_NAME=appsolo_client_hub_dev` in `.env`.

```bash
pnpm db:migrate
pnpm db:seed
```

To prepare the test database, use the guarded reset. It uses `TEST_DATABASE_URL` when set, otherwise the local `DB_*` connection components with the fixed `appsolo_client_hub_test` database name; it never uses `DATABASE_URL`. It rejects production or non-local targets.

```bash
pnpm --filter @appsolo/database test:prepare
```

`pnpm db:reset` performs a guarded destructive reset only for the configured local `appsolo_client_hub_dev` database. It drops only that database's `public` and Drizzle journal schemas, then reapplies the migration and seed.

## Run the application

```bash
pnpm dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/api/v1/health>

The default development identity is the seeded client administrator:

| Identity             | ID                                     | Access                         |
| -------------------- | -------------------------------------- | ------------------------------ |
| Client administrator | `20000000-0000-4000-8000-000000000003` | Northstar Demo Co. project     |
| Client member        | `20000000-0000-4000-8000-000000000004` | Northstar Demo Co. project     |
| Other tenant user    | `20000000-0000-4000-8000-000000000005` | Denied from the seeded project |

Change `VITE_DEV_AUTH_USER_ID` and the API `DEV_AUTH_USER_ID`, or send `x-dev-user-id` directly to the API, to test a seeded identity. Development authentication is prohibited when `NODE_ENV=production`.

## Commands

```bash
pnpm dev            # web and API development servers
pnpm lint           # ESLint
pnpm typecheck      # strict TypeScript checks
pnpm test           # shared/database unit tests
pnpm test:api       # resets isolated test DB, then API integration tests
pnpm test:web       # React Testing Library component tests
pnpm test:e2e       # resets test DB, then Playwright browser smoke
pnpm build          # production builds
pnpm db:generate    # generate Drizzle migration from schema changes
pnpm db:migrate     # apply checked-in migration to configured DB
pnpm db:seed        # idempotently add fake P001 data
pnpm db:reset       # guarded local configured DB reset
pnpm docker:up      # start local PostgreSQL Compose service
pnpm docker:down    # stop local PostgreSQL Compose service
```

## Troubleshooting

- **Migration says a relation already exists:** confirm `.env` points at `appsolo_client_hub_dev`, not another application's database. P001 migrations are initial-schema migrations and must not be applied to an unrelated database.
- **`db:reset` refuses to run:** it intentionally requires a local `appsolo_client_hub_dev` target; `test:prepare` accepts only the separate `appsolo_client_hub_test` target.
- **Browser shows a retryable error:** verify the API health endpoint and that `CORS_ORIGIN` includes the web origin (`localhost` and `127.0.0.1` are included in the examples).
- **Development auth returns 401:** use an active seeded UUID and rerun `pnpm db:seed` if needed.
- **Compose does not initialize the test database:** use a fresh Compose volume or create the named test database once; initialization SQL runs only for new volumes.

## Current limitations and future direction

P001 deliberately excludes real login, estimates/approval mutation, comments, time tracking, attachments, email, billing, AWS resources, and production deployment. Authentication remains a provider-neutral adapter; a later phase can replace the development adapter with Cognito. Planned production direction is React hosting, an Express container, PostgreSQL, Cognito, S3, SES, CloudWatch, and AWS infrastructure only in their approved future phases.

See [the current state](markdown/CURRENT_STATE.md), [architecture](markdown/ARCHITECTURE.md), and [P001 record](markdown/phases/P001-local-foundation-and-change-request-vertical-slice.md).
