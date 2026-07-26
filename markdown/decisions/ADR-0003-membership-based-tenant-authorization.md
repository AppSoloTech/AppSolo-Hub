---
id: ADR-0003
title: Enforce tenant access through organization membership and scoped services
status: accepted
date: 2026-07-25
approved_by: human
---

# ADR-0003 — Membership-Based Tenant Authorization

## Context

Client projects and their requests must be isolated. Internal AppSolo users also need scoped access to client tenants. Adding speculative global-admin bypasses or project-assignment tables would weaken or complicate the first slice.

## Decision

- A project belongs to one client organization.
- A user must have a membership with lifecycle status `ACTIVE` in that client organization to access the project.
- Internal users also belong to AppSolo's internal organization, but that membership grants no automatic client access.
- Internal service users receive an explicit role-bearing membership in each client organization they support.
- Services own capability checks; repositories execute authorized scoped queries.
- PostgreSQL row-level security is deferred.
- P002 suspends/reactivates membership rows instead of deleting them and centralizes role/capability ceilings in application policy.
- Every invitation and membership access mutation creates an immutable organization-scoped audit event in the same transaction.

## Alternatives Considered

- Internal users have implicit global access.
- Add `project_memberships` immediately.
- Add duplicate `organization_id` to every child table.
- Implement PostgreSQL row-level security in P001.

## Consequences

- Tenant access is explicit and testable.
- Internal staff membership in client organizations must be managed carefully.
- More granular project-only assignment may be added later if actual need appears.
- Application-layer authorization is a critical review area.
- Suspended membership must be included in every project/request and administration authorization query, never only hidden in React.
