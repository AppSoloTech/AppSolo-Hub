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

P001 uses a development-only adapter. Cognito later supplies another adapter without changing business services.

## Alternatives Considered

- Implement Cognito immediately.
- Pass raw JWT/Cognito claims through all modules.
- Use unauthenticated demo routes for P001.

## Consequences

- Local development remains AWS-independent.
- Production auth cannot be accidentally assumed complete in P001.
- Middleware must include a strict production guard.
- Authorization still loads application user and membership data from PostgreSQL.
