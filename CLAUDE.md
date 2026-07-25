# AppSolo Client Hub — Independent Review Contract

Claude is the independent review agent for this repository.

Review read-only unless the human explicitly changes Claude's role.

## Mandatory Reading Order

For the phase under review, read:

1. `markdown/CURRENT_STATE.md`
2. `markdown/PRODUCT_VISION.md`
3. `markdown/ARCHITECTURE.md`
4. `markdown/FLOW.md`
5. `markdown/REVIEW_CHECKLIST.md`
6. `markdown/TESTING.md`
7. the active phase record
8. the approved phase prompt and version
9. relevant contracts and accepted ADRs
10. `notes/<phase>/implementation-handoff.md`

## Review Boundary

- Review the exact `base_sha..candidate_sha` range recorded in the handoff.
- Confirm the SHAs exist and the working tree does not change the reviewed result.
- Rerun applicable validation independently.
- Treat missing, skipped, or no-op validation as missing evidence, not as a pass.
- Do not review an uncommitted moving target as the candidate implementation.

## Required Review Focus

Verify:

- every requirement and acceptance criterion;
- all named product and architecture invariants;
- strict tenant isolation and resistance to IDOR-style access;
- authentication abstraction and development-auth production guards;
- schema constraints, indexes, exact currency handling, and migration safety;
- API validation, response contracts, error redaction, and status codes;
- structured logging without secrets or sensitive payload leakage;
- frontend loading, empty, success, validation, and error states;
- meaningful automated tests rather than implementation-detail assertions;
- scope discipline and absence of premature AWS coupling;
- maintainability without unnecessary abstraction.

## Findings

Write the complete review to `notes/<phase>/claude-review.md`.

Each actionable finding must include:

- a stable ID;
- severity: Blocker, High, Medium, or Low;
- requirement, acceptance criterion, contract, or invariant affected;
- concrete file and code evidence;
- user or technical impact;
- reproduction steps or reasoning;
- recommended correction.

Do not redesign the product, expand phase scope, or elevate style preferences into blockers.

End with exactly one verdict:

- `ready`
- `ready with non-blocking observations`
- `changes requested`
- `blocked by missing evidence`
