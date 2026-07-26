# Environment Contract

## Runtime Direction

P001 targets a modern supported Node.js runtime and a pinned pnpm version through the root `packageManager` field.

Codex must inspect and record the actual local versions before implementation. The initial compatibility target is:

- Node.js 22 or newer supported LTS-compatible release;
- pnpm 10-compatible workspace tooling;
- Docker Engine and Docker Compose v2;
- PostgreSQL 16-compatible local container.

A material version change that affects architecture or AWS compatibility requires an ADR. A patch/minor tool pin does not.

## Environment Files

Expected files after P001:

```text
.env.example                  # Docker/local defaults only, no real secrets
apps/api/.env.example         # API variables
apps/web/.env.example         # Vite public variables
.env                          # local, ignored
apps/api/.env                 # local, ignored if used
apps/web/.env                 # local, ignored if used
```

Codex may consolidate local loading if the behavior remains clear and documented. Real credentials must never be committed.

## API Variables

| Name                        | Required            | Example                                       | Rules                                                                              |
| --------------------------- | ------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `NODE_ENV`                  | yes                 | `development`                                 | `development`, `test`, `production`                                                |
| `PORT`                      | yes                 | `4000`                                        | integer 1-65535                                                                    |
| `DATABASE_URL`              | yes                 | local dev URL                                 | secret outside local development                                                   |
| `TEST_DATABASE_URL`         | tests               | local test URL                                | must be distinct from dev URL                                                      |
| `APPSOLO_DB_NAME`           | local component env | `appsolo_client_hub_dev`                      | optional local database-name override when `DB_*` connection components are reused |
| `LOG_LEVEL`                 | yes                 | `debug`                                       | validated Pino level                                                               |
| `CORS_ORIGIN`               | yes                 | `http://localhost:5173,http://127.0.0.1:5173` | explicit comma-separated local origins, each validated                             |
| `DEV_AUTH_ENABLED`          | yes                 | `true`                                        | allowed only in development/test                                                   |
| `DEV_AUTH_USER_ID`          | dev                 | seeded UUID                                   | fallback simulated user                                                            |
| `APPSOLO_USE_TEST_DATABASE` | Playwright only     | `false`                                       | validated test-only switch; uses `TEST_DATABASE_URL` or fixed local test target    |
| `REQUEST_BODY_LIMIT`        | no                  | `1mb`                                         | safe explicit limit                                                                |

Rules:

- API startup validates configuration with Zod before opening a listener.
- Explicitly exported process values take precedence over root `.env`, which takes precedence over duplicate `apps/api/.env` values.
- Production startup fails when `DEV_AUTH_ENABLED=true`.
- `APPSOLO_USE_TEST_DATABASE` defaults to `false`; Playwright sets it to `true` only after preparing the isolated test database. It is not an operator-facing development setting.
- Playwright starts fresh API and web processes and never reuses an already-running development API.
- URLs and secrets are redacted from logs.
- Tests use `TEST_DATABASE_URL` when configured. For local component configuration they derive only the fixed `appsolo_client_hub_test` target from `DB_*`; they never fall back to `DATABASE_URL`, and do not mutate the developer's process environment without cleanup.

## Web Variables

| Name                    | Required | Example                        | Rules                                                    |
| ----------------------- | -------- | ------------------------------ | -------------------------------------------------------- |
| `VITE_API_BASE_URL`     | yes      | `http://localhost:4000/api/v1` | public browser value                                     |
| `VITE_DEV_AUTH_USER_ID` | dev      | seeded UUID                    | optional initial local identity before explicit sign-out |
| `VITE_APP_NAME`         | no       | `AppSolo Client Hub`           | display only                                             |

All `VITE_` variables are public in the built browser bundle. They must never contain secrets.

P002 initializes the browser development session from `VITE_DEV_AUTH_USER_ID` only when no prior explicit sign-out or selected identity exists. Thereafter, the browser stores only the selected development user ID. Invitation tokens and acceptance URLs are never configuration values or browser-storage values.

## Docker Variables

| Name                | Example                  |
| ------------------- | ------------------------ |
| `POSTGRES_USER`     | `appsolo`                |
| `POSTGRES_PASSWORD` | `appsolo_local_only`     |
| `POSTGRES_DB`       | `appsolo_client_hub_dev` |
| `POSTGRES_PORT`     | `5432`                   |

These example values are explicitly local. Production credentials come from a secret manager in a later phase.

Docker initialization should create a separate `appsolo_client_hub_test` database.

## Default Local URLs

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/api/v1/health`
- PostgreSQL: `localhost:5432`

If Codex changes a port because of an actual conflict, it must update examples, tests, README, and contracts together.

## Environment Validation Requirements

P001 tests must prove:

- valid development configuration parses;
- missing database URL fails;
- invalid port fails;
- production plus development auth fails;
- web environment rejects a missing or invalid API base URL;
- parsing errors do not echo secret values.
- production configuration continues to reject development authentication after P002.
