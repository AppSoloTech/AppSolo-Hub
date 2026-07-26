---
id: ADR-0004
title: Represent money with PostgreSQL numeric and decimal strings
status: accepted
date: 2026-07-25
approved_by: human
---

# ADR-0004 — Exact Decimal Money

## Context

Estimates contain hourly rates and estimated costs. JavaScript numbers use binary floating point and can introduce currency rounding errors.

## Decision

Store money as PostgreSQL `numeric(12,2)`. Represent money in TypeScript and JSON as normalized decimal strings. Use decimal-safe arithmetic when P003 implements estimate calculations.

Estimated hours use `numeric(8,2)` and decimal strings.

P003 implements the decision with strict fixed-scale decimal-string schemas and
`BigInt` hundredths multiplication. Cost rounds half up to two digits without
passing through JavaScript `number`. PostgreSQL independently enforces
`estimated_cost = round(estimated_hours * hourly_rate, 2)`.

## Alternatives Considered

- JavaScript numbers and PostgreSQL floating point.
- Integer cents with renamed fields.
- A money microservice.

## Consequences

- DTOs visibly distinguish exact decimals from ordinary numbers.
- Formatting and arithmetic need explicit helpers or a reviewed decimal library later.
- Database rows must not be blindly coerced to numbers.
- Numeric limits and calculated-cost overflow must be rejected before
  persistence.
