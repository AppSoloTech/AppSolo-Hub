---
id: P004
title: Comments And Clarification
status: approved
owner: codex
reviewer: claude
prompt: prompts/active/P004-comments-and-clarification.md
depends_on: [P003]
base_branch: main
base_sha: null
candidate_sha: null
risk: high
human_qa_required: true
---

# P004 — Comments And Clarification

## Outcome

Add request communication while preserving strict internal-only and client-visible boundaries.

## Approved Scope

- Create and list authorized comments.
- Internal-only visibility enforcement.
- Ordered append-only request conversation.
- P003 clarification discussion continuity without comment-driven status changes.
- Client-safe DTOs and tests.
- Additive data integrity and deterministic seed coverage.

## Approved Non-Goals

- Real-time chat.
- Comment editing, deletion, reactions, or nested threads.
- Changes to P003 estimate decisions or lifecycle ownership.
- Email delivery.
- File attachments.
- P005 work/status behavior and all later cloud phases.

## Approval State

The human approved P004 specification version 1 and all twelve binding decisions
on 2026-07-27.

- Active prompt: `prompts/active/P004-comments-and-clarification.md`,
  specification version 1.
- Draft basis: authoritative local `main` at
  `a6a3e728e67fa43004bb08d4b64b0e48aec5372f`.
- Human approval: granted on 2026-07-27.
- Binding decisions: all twelve approved without revision.
- Implementation: authorized, subject to mandatory repository revalidation and
  Git-boundary establishment.
- Dependencies: P003 is complete and locally integrated.

The approved prompt contains stable R, AC, V, Q, and NG identifiers. Its
conversation model, append-only behavior, capability matrix, safe internal
default, body contract, clarification ownership, lifecycle availability,
historical authorship, visibility-oracle prevention, and notification boundary
are binding for P004.

## Evidence

- Drafted: 2026-07-27.
- Approved: 2026-07-27.
- Draft basis SHA: `a6a3e728e67fa43004bb08d4b64b0e48aec5372f`.
- Approval boundary revalidated: authoritative local `main` at
  `06c1e0714ea18b1b37173917a45c023220f49e30`.
- Base branch: `main`; implementation base SHA remains pending approval commit
  creation.
- Active prompt: `prompts/active/P004-comments-and-clarification.md`, version 1.
- Draft authorization: human, 2026-07-27.
- Candidate SHA: pending.
- Review: not started.
- Human QA: not started.
- Completion: not eligible.

## Completion Gate

- Requirements implemented: No; implementation has not started.
- Automated validation: pending.
- Independent review clear: No; review has not started.
- Findings dispositioned: not applicable yet.
- Required human QA complete: No.
- Human integration and completion approval: No.
