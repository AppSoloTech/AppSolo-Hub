---
id: ADR-0005
title: Use CSS Modules and global design tokens for P001
status: accepted
date: 2026-07-25
approved_by: human
---

# ADR-0005 — CSS Modules And Design Tokens

## Context

The product needs a professional dashboard shell without spending the foundation phase integrating or customizing a large UI framework.

## Decision

Use a small global stylesheet for reset and design tokens, plus CSS Modules for component and route styles.

## Alternatives Considered

- Tailwind CSS.
- Material UI, Chakra UI, Ant Design, or another component framework.
- Unscoped global CSS only.

## Consequences

- Styling remains dependency-light and locally understandable.
- Common components must be built deliberately when actual reuse appears.
- A later design-system change requires evidence and an ADR if it affects multiple phases.
