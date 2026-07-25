# Product Audit

## Observed Problem

Client change requests commonly arrive through multiple channels and at unpredictable times. That produces fragmented context, repeated clarification, weak approval evidence, and costly context switching for a small consultancy.

The product brief identifies a need for one system that carries a request from submission through estimate, approval, work, and completion history.

## Root Causes

### Requests Are Unstructured

Email and chat do not consistently require a project, priority, target date, or complete description.

### Scope And Approval Are Separated From The Request

An estimate may exist in another message or document, making it difficult to prove which scope was approved.

### Status Is Informal

Without a controlled workflow, phrases such as “working on it,” “ready,” or “done” can mean different things to different participants.

### Internal And Client Notes Need Different Visibility

A consultancy needs private implementation notes without risking accidental client exposure.

### Multi-Tenant Security Cannot Be Added Later As A Cosmetic Layer

Organization and project access must shape repositories, services, tests, and route behavior from the first slice.

### First-Time AWS Use Creates A Coupling Risk

Trying to learn AWS while simultaneously proving the domain can cause cloud details to dominate the application architecture. The first phase therefore remains local and provider-neutral.

## P001 Diagnosis

The highest-value first proof is not every planned feature. It is a working, authorized request path:

```text
React form -> shared validation -> Express route -> service authorization
-> Drizzle transaction -> PostgreSQL -> API response -> React detail/list
```

If this path is reliable, later estimate, comment, time, attachment, and notification features can reuse the same tenant and module boundaries.

## Main Risks To Review In P001

- trusting a project ID without verifying active organization membership;
- allowing development-auth headers in production;
- sharing database rows before filtering by tenant authorization;
- implementing currency as JavaScript floating-point numbers;
- returning raw database or stack errors;
- creating a monorepo whose scripts are green but do not execute real checks;
- using a frontend-only simulated user selector as if it were authorization;
- adding AWS libraries or resource assumptions before an approved cloud phase;
- creating duplicated documentation truth under both `docs/` and `markdown/`;
- producing a candidate review from an uncommitted or changing working tree.

## Open Product Questions For Later Phases

These do not block P001:

- whether client administrators can approve estimates alone or require named approvers;
- whether estimates can contain line items or only aggregate hours/rate/cost;
- whether requests may be reopened after completion;
- whether time entries are visible to clients by default;
- attachment retention and maximum size;
- email notification preferences and digest behavior;
- invitation expiration and resend behavior;
- exact AWS account, region, networking, and production environment strategy;
- billing or invoicing integration, which is outside the current roadmap.
