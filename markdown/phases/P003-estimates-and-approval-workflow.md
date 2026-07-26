---
id: P003
title: Estimates And Approval Workflow
status: implementing
owner: codex
reviewer: claude
prompt: prompts/active/P003-estimates-and-approval-workflow.md
depends_on: [P002]
base_branch: main
base_sha: 274a9897c9fc8c681b4d1eac13ca8b16c0107a62
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

The human approved P003 specification version 1 on 2026-07-26.

- Active prompt: `prompts/active/P003-estimates-and-approval-workflow.md`,
  specification version 1.
- Draft basis: authoritative local `main` at
  `745892af6c9393838e490f12ddaa3536a9524f88`.
- Human approval: granted on 2026-07-26.
- Implementation: authorized, subject to mandatory repository revalidation and
  Git-boundary establishment.
- Dependencies: P002 is complete and locally integrated.
- Revalidation: passed on 2026-07-26 against the approved local-main boundary;
  the active prompt remains valid without scope revision.
- Implementation branch: `phase/P003-estimates-and-approval-workflow`.
- Implementation base: local `main` at
  `274a9897c9fc8c681b4d1eac13ca8b16c0107a62`.

The approved prompt contains stable R, AC, V, Q, and NG identifiers. Its exact
decimal and rounding policy, implicit currency, estimate-management and approval
capabilities, draft/submission visibility, revision/supersession lifecycle,
response-note requirements, and concurrency behavior are binding for P003.

## Evidence

- Drafted: 2026-07-26.
- Approved: 2026-07-26.
- Draft basis SHA: `745892af6c9393838e490f12ddaa3536a9524f88`.
- Base branch: `main`.
- Base SHA: `274a9897c9fc8c681b4d1eac13ca8b16c0107a62`.
- Revalidated: 2026-07-26; approved assumptions matched the current schema,
  seed, capability policy, API composition, request detail UI, and dependency
  manifests.
- Implementation started: 2026-07-26 on
  `phase/P003-estimates-and-approval-workflow`.
- Candidate SHA: pending.
- Review: not started.
- Human QA: not started.
- Completion: not eligible.
