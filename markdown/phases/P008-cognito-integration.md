---
id: P008
title: Cognito Integration
status: draft
owner: codex
reviewer: claude
prompt: null
depends_on: [P007]
base_branch: main
base_sha: null
candidate_sha: null
risk: high
human_qa_required: true
---

# P008 — Cognito Integration

## Outcome

Replace development/provider-neutral sign-in adapters with Cognito while preserving application auth contracts.

## Candidate Scope

- Cognito sign-in and JWT validation.
- User/account mapping.
- Invitation or first-login integration.
- Production removal of development auth.

## Candidate Non-Goals

- Broad AWS runtime provisioning.
- Social login unless approved.
- Custom identity provider.

## Approval State

This phase is a roadmap record only.

- Prompt: not drafted.
- Human approval: not granted.
- Implementation: must not begin.
- Dependencies: P007 must be complete or explicitly waived.

Before approval, create a consolidated prompt with stable R, AC, V, Q, and NG identifiers and resolve material product decisions.

## Evidence

- Base SHA: pending.
- Candidate SHA: pending.
- Review: not started.
- Human QA: not started.
- Completion: not eligible.
