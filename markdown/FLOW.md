# Phase Delivery Flow

## Operating Principle

> Markdown governs, prompts specify, Codex implements, Claude challenges, notes preserve evidence, Git fixes the review boundary, and the human owns product truth and completion.

## Agent Roles

### Codex

Codex inspects, revalidates, implements, tests, documents, creates the candidate commit, writes the handoff, and applies only accepted review fixes.

Codex does not independently approve its work or mark a phase complete.

### Claude

Claude independently reviews the immutable diff, reruns applicable validation, records evidence-backed findings, and issues a verdict.

Claude is read-only unless the human explicitly requests implementation.

### Human

The human approves scope, resolves material product decisions, dispositions every finding, performs or accepts manual QA, and controls final Git integration and completion.

## Source-Of-Truth Precedence

1. Latest explicit human decision.
2. Accepted product principles and ADRs.
3. Active phase record and approved prompt.
4. Technical contracts.
5. Current-state, audit, and roadmap summaries.
6. Historical phase records, archived prompts, and old notes.

If two sources at the same level conflict, report the conflict. Do not silently choose the convenient instruction.

## Canonical Phase States

```text
draft
  -> approved
  -> implementing
  -> review_pending
  -> changes_requested
  -> reviewed
  -> qa_pending
  -> complete
```

Side states:

```text
blocked
deferred
superseded
cancelled
```

### State Meanings

- `draft`: scope or prompt is not approved.
- `approved`: the human has approved implementation.
- `implementing`: Codex is modifying code on the scoped branch.
- `review_pending`: a candidate commit and handoff exist.
- `changes_requested`: unresolved Blocker or High findings remain.
- `reviewed`: review is clear and all findings are dispositioned or awaiting QA only.
- `qa_pending`: required human QA remains.
- `complete`: requirements, validation, review, disposition, QA, documentation, and Git evidence are recorded.
- `blocked`: an external or material decision prevents progress.
- `deferred`: intentionally postponed without being rejected.
- `superseded`: replaced by another phase or prompt.
- `cancelled`: intentionally abandoned.

“Implemented” is not a phase state and is not synonymous with complete.

## Lifecycle

### 1. Human Approves

- Select the roadmap outcome.
- Approve the consolidated prompt revision.
- Set the phase record to `approved`.

### 2. Codex Revalidates

- Inspect repository state and tool versions.
- Verify assumptions against current code.
- Classify the prompt as valid, revised, split, deferred, superseded, or cancelled.
- Record evidence in the phase record.
- Stop only for a material conflict.

### 3. Establish Git Boundary

- Inspect `git status`.
- Preserve unrelated work.
- Initialize Git only if no repository exists.
- Create `phase/<phase-id>-<slug>`.
- Record the base branch and exact base SHA.
- Set status to `implementing`.

Do not use `git add .` without first confirming every staged path belongs to the phase.

### 4. Implement And Validate

- Implement only approved requirements.
- Preserve invariants and non-goals.
- Add meaningful tests.
- Update contracts and ADRs when necessary.
- Run every applicable command from the prompt and `TESTING.md`.
- Record pass, fail, or not run honestly.

### 5. Create Candidate

- Confirm the diff contains only phase work.
- Create the candidate commit.
- Record candidate SHA.
- Write the implementation handoff.
- Set status to `review_pending`.
- Do not push unless explicitly instructed.

### 6. Claude Reviews

- Confirm the exact SHA range.
- Review code and behavior independently.
- Rerun important checks.
- Write `notes/<phase>/claude-review.md`.
- Use the shared severity vocabulary and one allowed verdict.

### 7. Human Dispositions Findings

Every finding receives one disposition:

- `Accepted`
- `Rejected`
- `Deferred`
- `Clarification required`

The reason and destination phase or fix commit must be recorded.

### 8. Codex Applies Accepted Fixes

- Apply only accepted, in-scope corrections.
- Create one or more review-fix commits.
- Rerun validation.
- Update evidence.

### 9. Claude Verifies Important Fixes

Claude rechecks every accepted Blocker and High finding and any Medium finding the human identifies as release-critical.

### 10. Human QA And Integration

- Execute every required Q-case.
- Record environment, setup, result, and evidence.
- Do not mark unrun tests passed.
- Merge, squash, amend, or reject the branch.
- Set `complete` only after every completion gate is satisfied.

## Branch And Commit Convention

- Branch: `phase/P001-local-foundation`
- Candidate commit: `P001: implement local foundation vertical slice`
- Review-fix commit: `P001: address accepted review findings`

Commit wording may vary, but each candidate must be immutable and identifiable.

## Review Severity

### Blocker

Data loss, tenant/security breach, destructive migration, unusable build, leaked secret, or fundamental contract failure.

### High

Acceptance-criterion failure, serious regression, production-environment auth bypass, inaccessible critical flow, or likely runtime failure.

### Medium

Meaningful edge case, incomplete error handling, maintainability risk, weak test coverage, or support burden.

### Low

Minor polish, naming, documentation, or optional simplification.

Blocker and High findings prevent a ready verdict. Medium and Low findings still require human disposition.

## P001 Completion Gate

P001 may become `complete` only when:

- all R and AC items are satisfied or explicitly revised by the human;
- lint, typecheck, tests, builds, migrations, seed, and smoke checks have evidence;
- the API and UI run together locally;
- tenant denial behavior is verified;
- Claude's verdict is ready or ready with non-blocking observations;
- every finding has a recorded disposition;
- required human QA is complete;
- contracts and current state match shipped behavior;
- base, candidate, fix, and final Git evidence are recorded;
- the human approves integration.
