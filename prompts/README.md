# Phase Prompts

This directory contains executable work orders.

- `active/`: the consolidated prompt currently approved for implementation.
- `archive/`: superseded prompt revisions retained as historical evidence.
- `PHASE_TEMPLATE.md`: starting structure for future prompts.

A phase record is canonical for status. A prompt is canonical for the approved implementation contract only after the human approves its version.

## Versioning Rules

When requirements materially change:

1. copy the current prompt to `archive/` with its old version suffix;
2. consolidate all valid instructions into a new active prompt;
3. increment `spec_version`;
4. update the phase record;
5. record the reason for revision.

Do not append contradictory dated addenda to an active prompt.

## Identifiers

- Requirements: `R1`, `R2`, ...
- Acceptance criteria: `AC1`, `AC2`, ...
- Automated validation: `V1`, `V2`, ...
- Human QA: `Q1`, `Q2`, ...
- Non-goals: `NG1`, `NG2`, ...

Codex maps implementation evidence to these IDs. Claude maps review findings to the same contract.
