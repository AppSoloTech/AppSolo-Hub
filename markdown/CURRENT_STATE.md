# Current State

## Shipped

P001 — Local Foundation And Change-Request Vertical Slice is complete and integrated locally.
P002 — Authentication And Invitations is complete and integrated locally.

The shipped local application includes:

- a pnpm strict-TypeScript workspace with React/Vite, Express, shared Zod contracts, and Drizzle/PostgreSQL;
- Docker Compose PostgreSQL with isolated `appsolo_client_hub_dev` and `appsolo_client_hub_test` databases;
- provider-neutral development sign-in/session behavior and API-enforced tenant authorization;
- secure local invitation creation, resend, revoke, single-use acceptance, and
  exact role ceilings;
- active/suspended organization membership lifecycle with optimistic conflict
  handling and lockout protection;
- immutable tenant-scoped access audit history and role-aware access-management UI;
- authorized change-request list, detail, and transactional creation behavior;
- meaningful unit, API integration, component, and Playwright browser tests;
- reviewed error handling, request correlation, environment isolation, redaction,
  and durable P001/P002 evidence.

P001's final reviewed, validated, and human-QA boundary is `54c6e274fa0aa3d5b7d2498a60235b93b0cf2e5b`. Claude reported no open finding, and the human passed Q1-Q8 and approved integration on 2026-07-26.

P002's final reviewed, validated, and human-QA boundary is
`1fcd501c45ebf3c2f2e10db09fbeaf2ee076a03e`. Claude verified P002-F1 through
P002-F7 fixed with no open finding, the human passed Q1-Q10, accepted the
implementation state, and marked P002 complete on 2026-07-26.

## Active Phase

- Active phase: `P003 — Estimates And Approval Workflow`.
- P003 status: `approved`.
- P003 prompt: specification version 1 under `prompts/active/`.
- P003 implementation approval: granted by the human on 2026-07-26.

## Current Constraints

- Local development only.
- No AWS resources or deployment.
- No AWS SDK dependencies.
- No production authentication.
- Development-only simulated authentication must be replaceable by a Cognito adapter later.
- `markdown/` is the canonical documentation and phase-control location.

## Significant Gaps

- No estimate or client approval workflow exists yet.
- Comments, time tracking, attachments, notifications, AWS infrastructure,
  delivery automation, production authentication, and production hardening
  remain in their sequenced future phases.
- P003 is approved but not yet implemented. Codex must revalidate the prompt
  against the current repository, establish the exact local-main Git boundary,
  and advance the phase through the normal review and QA lifecycle.

Codex must update this file only when the actual shipped state changes. Do not describe planned work as completed work.
