---
id: ADR-0002
title: Keep authentication provider-neutral inside application modules
status: accepted
date: 2026-07-25
approved_by: human
---

# ADR-0002 — Provider-Neutral Authentication Boundary

## Context

P001 needs a usable local identity while production authentication will eventually use Amazon Cognito. Reading Cognito claims throughout routes and services would couple the domain to a future provider and make local tests harder.

## Decision

Authentication middleware converts provider-specific evidence into:

```ts
interface AuthenticatedUser {
  userId: string;
  email: string;
}
```

P001/P002 use a development-only adapter. P002's normalized-email sign-in selects an active local database user and stores only that user ID in browser storage. Invitation acceptance may return the same application-owned session DTO, but neither path creates a provider credential.

Cognito later supplies another adapter without changing business services, capability policy, session DTO ownership, or invitation/membership use cases.

## Alternatives Considered

- Implement Cognito immediately.
- Pass raw JWT/Cognito claims through all modules.
- Use unauthenticated demo routes for P001.

## Consequences

- Local development remains AWS-independent.
- Production auth cannot be accidentally assumed complete in P001.
- Middleware must include a strict production guard.
- Authorization still loads application user and membership data from PostgreSQL.
- The local sign-in UI must remain clearly labeled as insecure development behavior.
- Provider-neutral session DTOs contain application users, active memberships, roles, and capabilities—not provider claims.
