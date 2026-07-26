# P001 Human QA

> Status: Passed. The human reported all required Q1-Q8 checks passed on 2026-07-26.

## Environment

- Operating system: Windows host with WSL Debian
- Browser/version: VS Code integrated browser `1.130.0`; Chromium `148`; Electron `42.6.0`
- Node/pnpm/Docker versions: Node `v24.15.0`; pnpm `11.10.0`; Docker Engine/CLI `29.6.2`; Compose `5.3.1`
- Application commit/build: `f57ce0f60ad906e38db9384d108f69d2fc18eba0`; local `pnpm dev` build
- Database state: Docker PostgreSQL 16 on host port 5433; migrated and seeded `appsolo_client_hub_dev`; isolated `appsolo_client_hub_test`; named volume retained
- Development user/tenant: `20000000-0000-4000-8000-000000000003`; Northstar Demo Co. client administrator

## Test Cases

| ID  | Setup And Action                           | Expected Result                                         | Actual Result                                                                                        | Status | Evidence                 |
| --- | ------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ | ------------------------ |
| Q1  | Follow README from a clean local app state | Web, API, and PostgreSQL start as documented            | Web loaded, API health reported service/database `ok`, and Compose PostgreSQL was healthy on 5433.   | Passed | Human report, 2026-07-26 |
| Q2  | Open seeded project as authorized user     | Several seeded requests render with project/org context | Both seeded requests rendered with Northstar Demo Co. and Northstar client portal context.           | Passed | Human report, 2026-07-26 |
| Q3  | Create valid request, open detail, refresh | Saved values persist from PostgreSQL                    | A valid request submitted, opened in detail, and retained its values after browser refresh.          | Passed | Human report, 2026-07-26 |
| Q4  | Submit invalid title/description           | Accessible field errors; no request created             | Short title/description produced accessible validation messages and did not create a request.        | Passed | Human report, 2026-07-26 |
| Q5  | Use unauthorized seeded identity           | List/detail/create denied with no tenant data           | Other-tenant list/create returned 403, scoped detail returned 404, and internal-only access was 403. | Passed | Human report, 2026-07-26 |
| Q6  | Trigger database/API failure               | Safe API error and useful retryable UI state            | Database stop produced safe 503/UI retry behavior; restart and retry restored the request list.      | Passed | Human report, 2026-07-26 |
| Q7  | Keyboard and narrow viewport use           | Primary dashboard/form remain usable                    | Keyboard navigation, focus behavior, and narrow-viewport list/detail/form use all passed.            | Passed | Human report, 2026-07-26 |
| Q8  | Restart local stack                        | Volume/reset behavior matches README                    | Normal Compose restart retained the named volume and browser-created request.                        | Passed | Human report, 2026-07-26 |

## Observed Failures

- None.

## Untested Conditions

- No required Q-case remains untested.

## QA Decision

- Required QA complete: Yes.
- Human acceptance: Passed on 2026-07-26.
