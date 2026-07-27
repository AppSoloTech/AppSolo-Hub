# AppSolo Client Hub

AppSolo Client Hub is a local multi-tenant portal for tracking client change
requests, access, exact estimates, client decisions, and request conversation.
P001 delivers the request vertical slice. P002 adds provider-neutral local
sessions and access administration. P003 adds versioned estimate drafting,
submission, approval, rejection, clarification, and immutable response history.
P004 adds ordered client-visible and internal-only comments.

Tenant authorization happens in the Express API. The React UI is a convenience layer, never the authorization boundary.

## Architecture

```text
React + Vite (apps/web) -> Express /api/v1 (apps/api) -> Drizzle + PostgreSQL (packages/database)
                              ^
                       shared Zod contracts (packages/shared)
```

| Area                | Responsibility                                                     |
| ------------------- | ------------------------------------------------------------------ |
| `apps/web`          | React Router, session/access/estimate/comment UI and query state   |
| `apps/api`          | Express routes, local auth, tenant-scoped domain services, logging |
| `packages/shared`   | Zod schemas, DTOs, enums, provider-neutral interfaces              |
| `packages/database` | Drizzle schema, checked-in migration, local seed and guarded reset |
| `e2e`               | Playwright request regression and invitation/session browser flow  |

`markdown/` is the canonical product and delivery control plane.

## Prerequisites

- Node.js `24.15.0` was verified (Node 22+ supported).
- pnpm `11.10.0` was verified; the repository pins this version.
- PostgreSQL 16-compatible server (PostgreSQL 17.9 client/server tooling was used during implementation).
- Docker Desktop `4.83.0`, Engine/CLI `29.6.2`, and Compose `5.3.1` were verified with the supplied local container setup.

## Installation and local configuration

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The API loads root `.env` and then `apps/api/.env` for local development. Values explicitly exported by the invoking process take precedence over both files, and root `.env` takes precedence over duplicate API-file values. Use either `DATABASE_URL` or all `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` values. `APPSOLO_DB_NAME` is an optional local override when those connection components are shared with another application; it should be `appsolo_client_hub_dev` for normal development.

All `.env` files are ignored. Never commit credentials. `VITE_` values are public browser configuration and must not contain secrets.

## PostgreSQL

### Docker Compose

The supplied Compose service creates `appsolo_client_hub_dev` and `appsolo_client_hub_test` on first volume initialization.

```bash
pnpm docker:up
pnpm db:migrate
pnpm db:seed
```

If another PostgreSQL service already uses port 5432, choose a free host port in `.env` (for example `POSTGRES_PORT=5433`) and use that same port in `DATABASE_URL` and `TEST_DATABASE_URL`. The container still listens on port 5432 internally.

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

On the first local visit, `VITE_DEV_AUTH_USER_ID` may initialize the browser identity. Use **Sign out** to reach the clearly labeled email-only development sign-in screen. This is intentionally insecure local behavior, not production authentication.

Seeded development identities include:

| Identity             | ID                                     | Access                                                      |
| -------------------- | -------------------------------------- | ----------------------------------------------------------- |
| Client administrator | `20000000-0000-4000-8000-000000000003` | Northstar Demo Co. project                                  |
| Client member        | `20000000-0000-4000-8000-000000000004` | Northstar Demo Co. project                                  |
| Other tenant user    | `20000000-0000-4000-8000-000000000005` | Acme Demo Co. client member; denied from Northstar project  |
| Internal-only user   | `20000000-0000-4000-8000-000000000006` | AppSolo internal developer; denied from all client projects |

Sign in with the seeded email address shown by the UI or send `x-dev-user-id` directly when testing the API. The browser stores only the selected development user ID and clears cached tenant data when that identity changes or signs out. It never stores invitation tokens, which arrive in a URL fragment and are removed before acceptance. Development authentication is prohibited when `NODE_ENV=production`. Set `WEB_ACCEPTANCE_BASE_URL` when copy-only invitation links should use a canonical web origin other than the first `CORS_ORIGIN`.

Owners, administrators, and client administrators see an **Access** navigation item for authorized organizations. From there they can view members/invitations/history, create a copy-only local acceptance link, resend/revoke pending invitations, and apply role/status changes within their exact role ceiling.

Open a change-request detail page to use estimates. Owners, administrators, and
developers with an active membership in that client organization can create,
edit, and submit the one current draft. Client administrators can approve,
reject, or request clarification for the current submitted version; client
members have read-only submitted/history access. Drafts are completely absent
for client roles. Hours, hourly rates, and server-derived USD costs use exact
two-decimal strings and round-half-up behavior.

The same request detail page includes an oldest-first conversation. Every active
tenant role can read and add client-visible comments. Owners, administrators,
and developers can also read/add internal-only comments, with every fresh
internal composer defaulting to **Internal only**. Client roles receive no
internal row, count, selector, or pagination gap. Comments do not resolve
clarification or change request/estimate lifecycle state.

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
pnpm db:seed        # idempotently add fake P001/P002/P003/P004 data
pnpm db:reset       # guarded local configured DB reset
pnpm docker:up      # start local PostgreSQL Compose service
pnpm docker:down    # stop local PostgreSQL Compose service
```

The Playwright command always starts its own API and web processes. If either development port is already occupied, stop that process before running the smoke test; Playwright will not reuse an API that may be connected to the development database.

## Troubleshooting

- **Migration says a relation already exists:** confirm `.env` points at `appsolo_client_hub_dev`, not another application's database. P001 migrations are initial-schema migrations and must not be applied to an unrelated database.
- **`db:reset` refuses to run:** it intentionally requires a local `appsolo_client_hub_dev` target; `test:prepare` accepts only the separate `appsolo_client_hub_test` target.
- **Browser shows a retryable error:** verify the API health endpoint and that `CORS_ORIGIN` includes the web origin (`localhost` and `127.0.0.1` are included in the examples).
- **Development sign-in returns 401:** use an active seeded email. Invited and globally suspended users are denied until their lifecycle permits sign-in.
- **Invitation link is invalid:** only the newest link survives resend; revoked, accepted, rotated, and unknown tokens share a safe invalid response. Expired invitations can be resent.
- **Membership update conflicts:** refresh the access page. Updates use `expectedUpdatedAt`, and self-suspension/last-owner lockout are deliberately rejected.
- **Compose does not initialize the test database:** use a fresh Compose volume or create the named test database once; initialization SQL runs only for new volumes.

## Current limitations and future direction

P004 deliberately excludes real-time chat, editing/deletion, nested threads,
attachments, notifications/delivery, time tracking/execution, payments,
Cognito, production sessions, AWS SDKs/resources, deployment, and CI/CD. A
later phase can replace the development adapter with Cognito without changing
business modules.

See [the current state](markdown/CURRENT_STATE.md),
[architecture](markdown/ARCHITECTURE.md), and
[P004 record](markdown/phases/P004-comments-and-clarification.md).
