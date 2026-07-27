---
id: P004
title: Comments And Clarification
status: draft
owner: codex
reviewer: claude
prompt: null
draft_prompt: prompts/drafts/P004-comments-and-clarification.md
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

## Draft Scope

- Create and list authorized comments.
- Internal-only visibility enforcement.
- Ordered append-only request conversation.
- P003 clarification discussion continuity without comment-driven status changes.
- Client-safe DTOs and tests.
- Additive data integrity and deterministic seed coverage.

## Draft Non-Goals

- Real-time chat.
- Comment editing, deletion, reactions, or nested threads.
- Changes to P003 estimate decisions or lifecycle ownership.
- Email delivery.
- File attachments.
- P005 work/status behavior and all later cloud phases.

## Approval State

This phase remains a non-authorizing draft.

- Prompt: draft version 1 created with human drafting authorization on
  2026-07-27.
- Draft basis: authoritative local `main` at
  `a6a3e728e67fa43004bb08d4b64b0e48aec5372f`.
- Human approval: not granted.
- Implementation: must not begin.
- Dependencies: P003 is complete and locally integrated.

Before approval, the human must review and accept or revise the consolidated
prompt, including its twelve proposed binding decisions and stable R, AC, V, Q,
and NG identifiers.

## Evidence

- Drafted: 2026-07-27.
- Draft basis SHA: `a6a3e728e67fa43004bb08d4b64b0e48aec5372f`.
- Base branch: `main`; implementation base SHA remains pending human approval
  and repository revalidation.
- Draft prompt: `prompts/drafts/P004-comments-and-clarification.md`, version 1.
- Draft authorization: human, 2026-07-27.
- Candidate SHA: pending.
- Review: not started.
- Human QA: not started.
- Completion: not eligible.
