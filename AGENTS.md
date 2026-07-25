# AppSolo Client Hub — AI Delivery Contract

Codex is the implementation agent for this repository.

## Mandatory Reading Order

Before implementing an approved phase, read:

1. `markdown/CURRENT_STATE.md`
2. `markdown/PRODUCT_VISION.md`
3. `markdown/ARCHITECTURE.md`
4. `markdown/FLOW.md`
5. the active phase record under `markdown/phases/`
6. the approved prompt referenced by that phase record
7. every relevant file under `markdown/contracts/`
8. relevant accepted ADRs under `markdown/decisions/`

Use the source-of-truth precedence defined in `markdown/FLOW.md`.

## Codex Responsibilities

For every phase:

- inspect the current repository and development environment before editing;
- revalidate the phase prompt against current code and the recorded base SHA;
- preserve unrelated user work and never stage unknown changes;
- remain within approved requirements, acceptance criteria, invariants, and non-goals;
- use strict TypeScript and avoid `any`;
- add or update meaningful tests for changed behavior;
- update technical contracts when behavior or architecture changes;
- run every applicable validation command from the phase prompt and `markdown/TESTING.md`;
- distinguish `Passed`, `Failed`, and `Not run` honestly;
- create an immutable candidate commit for Claude review;
- write `notes/<phase>/implementation-handoff.md` with exact evidence;
- update the canonical phase record through `review_pending`, but never mark it `complete`;
- apply only findings accepted by the human in `review-disposition.md`;
- rerun validation after accepted fixes and record fix commits.

## P001 Boundaries

For P001 specifically:

- create only the local PERN foundation and change-request vertical slice;
- do not deploy or configure AWS resources;
- do not import AWS SDK packages;
- do not implement Cognito, S3 uploads, SES, ECS, RDS, Amplify, billing, or production authentication;
- preserve the provider-neutral authentication and storage boundaries defined in the contracts;
- enforce tenant access in the API service/repository path, never only in React;
- do not push to GitHub or create a remote unless the human explicitly instructs it.

## Stop Conditions

Stop and request human direction only when proceeding would materially change:

- the approved product outcome;
- phase scope or sequencing;
- a cross-phase architecture decision;
- privacy or security behavior;
- destructive data behavior;
- an external system or paid service;
- a dependency with meaningful operational cost;
- unrelated user work already present in the repository.

Normal implementation choices within the approved contracts do not require a question.

Claude performs independent review. The human owns product decisions, finding disposition, manual QA, final Git integration, and phase completion.
