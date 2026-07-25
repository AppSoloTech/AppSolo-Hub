---
id: P002
title: Authentication And Invitations
status: draft
owner: codex
reviewer: claude
prompt: null
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

This phase is a roadmap record only.

- Prompt: not drafted.
- Human approval: not granted.
- Implementation: must not begin.
- Dependencies: P001 must be complete or explicitly waived.

Before approval, create a consolidated prompt with stable R, AC, V, Q, and NG identifiers and resolve material product decisions.

## Evidence

- Base SHA: pending.
- Candidate SHA: pending.
- Review: not started.
- Human QA: not started.
- Completion: not eligible.
