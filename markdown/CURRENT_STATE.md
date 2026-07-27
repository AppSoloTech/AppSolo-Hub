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

- No phase is approved or active.
- Next roadmap candidate: `P004 — Comments And Clarification`.
- P004 status: `draft`.
- P004 prompt: non-authorizing draft version 1 exists at
  `prompts/drafts/P004-comments-and-clarification.md` from authoritative local
  `main` at `a6a3e728e67fa43004bb08d4b64b0e48aec5372f`.
- P004 implementation approval: not granted.

## Current Constraints

- Local development only.
- No AWS resources or deployment.
- No AWS SDK dependencies.
- No production authentication.
- Development-only simulated authentication must be replaceable by a Cognito adapter later.
- `markdown/` is the canonical documentation and phase-control location.

## Significant Gaps

- Comments, time tracking, attachments, notifications, AWS infrastructure,
  delivery automation, production authentication, and production hardening
  remain in their sequenced future phases.
- P004's consolidated non-authorizing prompt has stable requirements,
  acceptance criteria, validation, QA, and non-goal identifiers. Its twelve
  proposed binding decisions must be accepted or revised before human approval.

Codex must update this file only when the actual shipped state changes. Do not describe planned work as completed work.
