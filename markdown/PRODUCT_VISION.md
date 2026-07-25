# Product Vision

## Product

**AppSolo Client Hub** is a multi-tenant client request, estimate, approval, and project-status portal for software consultants, freelancers, and small development agencies.

Its purpose is to replace scattered requests across email, text messages, and chat with one traceable workflow that both the service provider and client can understand.

## Primary Value

The product creates a durable shared record of:

- what a client requested;
- which project and organization the request belongs to;
- the requested priority and completion date;
- what AppSolo estimates the work will require;
- what the client approved, rejected, or asked to clarify;
- how the work progressed;
- what time, comments, release notes, and completion evidence were recorded.

The hub should reduce ambiguity, context switching, untracked scope changes, and disputes over what was requested or approved.

## Primary Users

### AppSolo Owner

Manages client organizations, access, projects, estimates, approvals, status, and final delivery history.

### AppSolo Administrator

Supports organization, project, request, and workflow administration without necessarily owning the business.

### AppSolo Developer

Reviews assigned client work, records internal and client-visible updates, logs time, and documents completion.

### Client Administrator

Manages client-side membership and can submit, review, approve, reject, or clarify requests according to future permissions.

### Client Member

Views authorized projects and submits or follows requests according to future permissions.

## Core Workflow

1. A user authenticates.
2. The user selects an authorized organization and project.
3. The user submits a change request.
4. AppSolo reviews and scopes the request.
5. AppSolo creates an estimate with hours, rate, cost, and scope notes.
6. The client approves, rejects, or requests clarification.
7. The request progresses through controlled statuses.
8. AppSolo records comments, work, time, release notes, and completion details.
9. Authorized users can review the complete history.

## P001 Product Slice

The first implemented slice is intentionally smaller:

- list change requests for one authorized project;
- view one change request;
- create and persist a submitted change request;
- validate input in both React and the API;
- enforce project and organization access in the API;
- display loading, empty, success, validation, and error states;
- use development-only simulated authentication behind a provider-neutral interface.

P001 proves the full local path from browser to API to PostgreSQL without using AWS.

## Product Principles

### Structured Before Feature-Rich

The product should establish a clear, auditable request lifecycle before adding broad project-management functionality.

### Tenant Safety Is Foundational

A user must never receive data from an organization or project they are not authorized to access. Frontend filtering is convenience only; the API owns enforcement.

### History Should Be Durable

Important changes should leave a persistent record rather than relying on mutable chat or memory.

### Explicit Approval Beats Assumption

Estimate and scope acceptance must eventually be recorded as an explicit client action.

### Clear Language Beats Decorative Complexity

The interface should be professional and understandable. P001 prioritizes hierarchy, feedback, and maintainability over visual novelty.

### Local Portability Before Cloud Coupling

The application must run locally without AWS. Cloud providers enter through explicit adapters and later approved phases.

### Small-Team Maintainability

Architecture should create real boundaries without enterprise-style abstraction that has only hypothetical value.

## Product Invariants

- Every project belongs to exactly one organization.
- Every change request belongs to exactly one project.
- Access to project descendants derives from active authorization to that project and its organization.
- Client and internal users are represented by the same user and membership model.
- Internal-only information must never be exposed to client roles.
- Money is never represented with floating-point currency arithmetic.
- Authentication-provider claims do not leak throughout business modules.
- AWS is not required for local development.
- The human remains the product authority and final completion owner for AI-delivered phases.

## Deliberate Non-Goals

AppSolo Client Hub is not initially:

- a general-purpose project-management suite;
- a replacement for source control or issue tracking;
- a real-time chat application;
- a CRM, accounting, invoicing, or payment platform;
- a public marketplace;
- a time-billing engine in P001;
- an attachment upload system in P001;
- an AWS-hosted application in P001;
- a production-authenticated application in P001.

## Success Direction

The product is moving in the right direction when:

- client requests are captured in one structured place;
- approvals and changes are unambiguous;
- AppSolo can understand scope and status without searching multiple channels;
- clients can understand what is pending and why;
- tenant boundaries remain reliable as features grow;
- each phase can be implemented and independently reviewed from repository evidence.
