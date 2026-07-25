---
id: ADR-0006
title: Use markdown as the canonical documentation and phase control plane
status: accepted
date: 2026-07-25
approved_by: human
---

# ADR-0006 — `markdown/` Is The Canonical Control Plane

## Context

The original product scaffold suggested a generic `docs/` directory. The newer AI delivery system separates durable truth, active prompts, and execution notes. Duplicating architecture and roadmap files across `docs/` and `markdown/` would create conflicting sources.

## Decision

Use `markdown/` for canonical product, architecture, process, contracts, ADRs, and phase records. Use `prompts/` for active work orders and `notes/` for phase execution evidence.

Do not create duplicate `docs/architecture.md` or `docs/roadmap.md` files. The root README links to canonical documents.

## Alternatives Considered

- Keep both directories synchronized manually.
- Put all process and product files in `docs/`.
- Store agent context only in chat history.

## Consequences

- Source precedence is clearer.
- Existing instructions referring to `docs/architecture.md` are fulfilled by the canonical `markdown/ARCHITECTURE.md` contract unless the human explicitly changes the decision.
- Historical and phase-specific evidence remains separated from durable policy.
