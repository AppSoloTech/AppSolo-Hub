# Current State

## Shipped

P001 — Local Foundation And Change-Request Vertical Slice is complete and integrated locally.
P002 — Authentication And Invitations is complete and integrated locally.
P003 — Estimates And Approval Workflow is complete and integrated locally.

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
- exact versioned estimate drafting/submission with immutable terms, optimistic
  concurrency, and additive PostgreSQL invariants;
- client-admin-only approval, rejection, and clarification decisions with
  durable response/status history and role-aware accessible UI;
- meaningful unit, API integration, component, and Playwright browser tests;
- reviewed error handling, request correlation, environment isolation, redaction,
  and durable P001/P002/P003 evidence.

P001's final reviewed, validated, and human-QA boundary is `54c6e274fa0aa3d5b7d2498a60235b93b0cf2e5b`. Claude reported no open finding, and the human passed Q1-Q8 and approved integration on 2026-07-26.

P002's final reviewed, validated, and human-QA boundary is
`1fcd501c45ebf3c2f2e10db09fbeaf2ee076a03e`. Claude verified P002-F1 through
P002-F7 fixed with no open finding, the human passed Q1-Q10, accepted the
implementation state, and marked P002 complete on 2026-07-26.

P003's final reviewed, validated, and human-QA boundary is
`cd8dcba9afcb72eee04ad4af1d909756d79bb07f`. Claude verified P003-F1 through
P003-F7 fixed with final verdict `ready`; the human passed Q1-Q10 and explicitly
approved completion and local integration on 2026-07-27.

## Active Phase

- Active phase: `P004 — Comments And Clarification`.
- P004 status: `qa_pending`.
- P004 prompt: specification version 1 under `prompts/active/`.
- P004 implementation approval: granted by the human on 2026-07-27, including
  all twelve binding decisions.
- Approval boundary: authoritative local `main` at
  `06c1e0714ea18b1b37173917a45c023220f49e30`.
- Implementation branch: `phase/P004-comments-and-clarification`, based on
  immutable approval commit `c64e42d6f08901b7dd72be9d11bfc37ed3af3149`.
- Immutable candidate:
  `f7d5d43fa43fafbccbc8f2525b31c9d01a87b045`; Claude completed its candidate
  review with five findings, and the human accepted P004-F1 through P004-F5 for
  correction. All accepted fixes are committed at
  `4c328f74a57076fa19f57937ae30867d5fabcbd2`; Claude independently verified
  P004-F1 through P004-F5 fixed with final verdict
  `ready with non-blocking observations`. The human passed Q1-Q10 by explicit
  attestation on 2026-07-27. Local integration and completion approval remain
  pending.

## Current Constraints

- Local development only.
- No AWS resources or deployment.
- No AWS SDK dependencies.
- No production authentication.
- Development-only simulated authentication must be replaceable by a Cognito adapter later.
- `markdown/` is the canonical documentation and phase-control location.

## Significant Gaps

- P004 comments are implemented, independently reviewed, corrected, and
  human-QA accepted, but are not shipped until the human explicitly approves
  completion and local integration.
- Time tracking, attachments, notifications, AWS infrastructure, delivery
  automation, production authentication, and production hardening remain in
  their sequenced future phases.

Codex must update this file only when the actual shipped state changes. Do not describe planned work as completed work.
