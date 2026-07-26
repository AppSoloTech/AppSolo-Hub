---
id: P002
title: Authentication And Invitations
status: approved
owner: codex
reviewer: claude
prompt: prompts/active/P002-authentication-and-invitations.md
depends_on: [P001]
base_branch: main
base_sha: null
candidate_sha: null
risk: high
human_qa_required: true
---

# P002 — Authentication And Invitations

## Outcome

Establish provider-neutral user access lifecycle, invitations, membership administration, and authorization capabilities without yet coupling business modules to Cognito.

## Candidate Scope

- Invitation creation, expiration, resend, and acceptance.
- Membership administration and role capabilities.
- Authentication/session-facing UI using an approved provider-neutral approach.
- Audit history for access changes.

## Candidate Non-Goals

- Production Cognito integration.
- SES delivery.
- AWS infrastructure.

## Approval State

The human approved P002 specification version 1 on 2026-07-26.

- Active prompt: `prompts/active/P002-authentication-and-invitations.md`, specification version 1.
- Draft basis: local `main` at `ccf344a406085a92669d867cc068e67c55519af3`.
- Human approval: granted on 2026-07-26.
- Implementation: authorized, subject to mandatory repository revalidation and Git-boundary establishment.
- Dependencies: P001 is complete.

The approved prompt contains stable R, AC, V, Q, and NG identifiers. Its invitation lifetime/state, role ceiling, local delivery, development-session, invitee-profile, token-transport, and audit-retention decisions are binding for P002.

## Evidence

- Drafted: 2026-07-26.
- Approved: 2026-07-26.
- Draft basis SHA: `ccf344a406085a92669d867cc068e67c55519af3`.
- Base SHA: pending implementation approval and revalidation.
- Candidate SHA: pending.
- Review: not started.
- Human QA: not started.
- Completion: not eligible.
