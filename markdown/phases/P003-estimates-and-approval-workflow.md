---
id: P003
title: Estimates And Approval Workflow
status: draft
owner: codex
reviewer: claude
prompt: null
depends_on: [P002]
base_branch: main
base_sha: null
candidate_sha: null
risk: high
human_qa_required: true
---

# P003 — Estimates And Approval Workflow

## Outcome

Create exact, durable estimate and client approval workflows linked to change requests.

## Candidate Scope

- Draft and submit estimates.
- Exact decimal hours, rates, and cost.
- Approve, reject, or request clarification.
- Transactional status and history updates.

## Candidate Non-Goals

- Payments or invoicing.
- Email notifications.
- Multi-currency.

## Approval State

This phase remains a roadmap record only.

- Draft prompt: `prompts/drafts/P003-estimates-and-approval-workflow.md`,
  specification version 1.
- Draft basis: authoritative local `main` at
  `745892af6c9393838e490f12ddaa3536a9524f88`.
- Human approval: not granted.
- Implementation: must not begin.
- Dependencies: P002 is complete and locally integrated.

The draft contains stable R, AC, V, Q, and NG identifiers. Before approval, the
human must approve or revise its exact decimal and rounding policy, implicit
currency, estimate-management and approval capabilities, draft/submission
visibility, revision/supersession lifecycle, response-note requirements, and
concurrency behavior.

## Evidence

- Drafted: 2026-07-26.
- Draft basis SHA: `745892af6c9393838e490f12ddaa3536a9524f88`.
- Base SHA: pending implementation approval and repository revalidation.
- Candidate SHA: pending.
- Review: not started.
- Human QA: not started.
- Completion: not eligible.
