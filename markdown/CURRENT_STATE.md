# Current State

## Shipped

P001 — Local Foundation And Change-Request Vertical Slice is complete and integrated locally.
P002 — Authentication And Invitations is complete and integrated locally.
P003 — Estimates And Approval Workflow is complete and integrated locally.
P004 — Comments And Clarification is complete and integrated locally.
P005 — Time Tracking, Status, And Completion is complete and integrated locally.

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
- ordered append-only request conversations with client-visible and
  internal-only capability enforcement;
- clarification follow-up that preserves immutable estimate reasons and never
  mutates request or estimate lifecycle state;
- private internal time with durable void correction, exact integer totals, and
  complete client redaction;
- controlled work, versioned review handoff, client response, completion, and
  cancellation transitions with immutable role-filtered history;
- persistent system-aware light/dark appearance and a strict canonical local
  web port that prevents CORS-breaking fallback;
- meaningful unit, API integration, component, and Playwright browser tests;
- reviewed error handling, request correlation, environment isolation, redaction,
  and durable P001/P002/P003/P004/P005 evidence.

P001's final reviewed, validated, and human-QA boundary is `54c6e274fa0aa3d5b7d2498a60235b93b0cf2e5b`. Claude reported no open finding, and the human passed Q1-Q8 and approved integration on 2026-07-26.

P002's final reviewed, validated, and human-QA boundary is
`1fcd501c45ebf3c2f2e10db09fbeaf2ee076a03e`. Claude verified P002-F1 through
P002-F7 fixed with no open finding, the human passed Q1-Q10, accepted the
implementation state, and marked P002 complete on 2026-07-26.

P003's final reviewed, validated, and human-QA boundary is
`cd8dcba9afcb72eee04ad4af1d909756d79bb07f`. Claude verified P003-F1 through
P003-F7 fixed with final verdict `ready`; the human passed Q1-Q10 and explicitly
approved completion and local integration on 2026-07-27.

P004's final reviewed, validated, and human-QA boundary is
`a2b187b5e346d766f9e66e4e3642d105dd555b70`. Claude verified P004-F1 through
P004-F5 fixed with final verdict `ready with non-blocking observations`; the
human passed Q1-Q10 and explicitly approved completion and local integration on
2026-07-27.

P005's final reviewed, validated, and human-QA boundary is
`386a856ad85fdb94a900596b1b8a4cf9df5978dd`. Claude verified P005-F1 through
P005-F6 with final verdict `ready with non-blocking observations`; the human
accepted and Codex corrected the resulting Low P005-F7 observation. The human
passed Q1-Q10 and explicitly approved completion and local integration on
2026-07-27.

## Active Phase

- No phase is approved or active.
- Next roadmap candidate: `P006 — Attachments With S3`.
- P006 status: `draft`.
- P006 prompt: not drafted.
- P006 implementation approval: not granted.

## Current Constraints

- Local development only.
- No AWS resources or deployment.
- No AWS SDK dependencies.
- No production authentication.
- Development-only simulated authentication must be replaceable by a Cognito adapter later.
- `markdown/` is the canonical documentation and phase-control location.

## Significant Gaps

- Attachments, notifications, AWS infrastructure, delivery
  automation, production authentication, and production hardening remain in
  their sequenced future phases.
- P006 requires a consolidated non-authorizing prompt with stable requirements,
  acceptance criteria, validation, QA, non-goal identifiers, and resolved
  material product decisions before human approval.

Codex must update this file only when the actual shipped state changes. Do not describe planned work as completed work.
