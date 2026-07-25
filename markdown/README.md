# Durable Project Control Plane

This directory contains reusable product, architecture, technical, process, and phase truth for AppSolo Client Hub.

## Read Order

Agents should normally read:

1. `CURRENT_STATE.md`
2. `PRODUCT_VISION.md`
3. `ARCHITECTURE.md`
4. `FLOW.md`
5. the active phase record
6. its approved prompt
7. relevant contracts and ADRs

## Responsibilities

- Constitution: `PRODUCT_VISION.md`, `ARCHITECTURE.md`
- Diagnosis and sequence: `PRODUCT_AUDIT.md`, `ROADMAP.md`, `CURRENT_STATE.md`
- Delivery process: `FLOW.md`, `REVIEW_CHECKLIST.md`, `TESTING.md`
- Cross-phase technical behavior: `contracts/`
- Accepted cross-phase decisions: `decisions/`
- Canonical phase status and evidence summary: `phases/`
- Generated short status view: `PHASE_INDEX.md`

`notes/` is intentionally separate. Notes preserve execution evidence for one phase; they are not universal policy.

Do not duplicate canonical architecture, roadmap, contract, or phase status in another documentation directory.
