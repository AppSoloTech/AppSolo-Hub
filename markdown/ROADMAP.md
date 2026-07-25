# Product Roadmap

This roadmap orders outcomes. Detailed implementation contracts belong in approved prompts, and canonical status belongs in individual phase records.

## P001 — Local Foundation And Change-Request Vertical Slice

Prove the local browser-to-database path with strict TypeScript, tenant authorization, shared validation, realistic seed data, and meaningful automated tests. No AWS.

## P002 — Authentication And Invitations

Add provider-neutral user access lifecycle, organization invitations, acceptance, membership administration, session-facing UI, and authorization capabilities. Production Cognito remains deferred until P008.

## P003 — Estimates And Approval Workflow

Allow AppSolo roles to draft and submit estimates with exact hours/rate/cost, and allow authorized client roles to approve, reject, or request clarification with durable history.

## P004 — Comments And Clarification

Add threaded or ordered request comments, explicit internal-only versus client-visible visibility, clarification states, and notification-ready events without leaking internal content.

## P005 — Time Tracking, Status, And Completion

Add time entries, controlled status transitions, work summaries, release notes, review handoff, completion details, and complete request history.

## P006 — Attachments With S3

Implement the existing storage interface using S3, direct or signed upload flows, metadata validation, authorization, size/type restrictions, retention decisions, and download access.

## P007 — Email Notifications With SES

Add provider-neutral notification preferences and SES-backed transactional email for invitations, estimates, approvals, clarification, and completion events.

## P008 — Cognito Integration

Replace development/provider-neutral sign-in adapters with Cognito JWT validation and production session flows while preserving the `AuthenticatedUser` business boundary.

## P009 — AWS Runtime Infrastructure

Provision reviewed infrastructure for Amplify Hosting, ECR, ECS Express Mode or Fargate, RDS PostgreSQL, Secrets Manager, CloudWatch, networking, environments, and least-privilege IAM.

## P010 — CI/CD And Release Automation

Add GitHub Actions validation and deployments using AWS OpenID Connect, migration execution strategy, environment promotion, rollback evidence, and protected release gates.

## P011 — Production Hardening And Launch Readiness

Complete security review, observability, backups and restore testing, performance checks, rate limiting, accessibility, operational runbooks, incident response, dependency review, and launch QA.

## Sequencing Rules

- P001 must be independently reviewed and accepted before cloud implementation.
- Tenant authorization patterns established in P001 are reused, not bypassed.
- S3, SES, Cognito, and runtime infrastructure each require explicit approved phases.
- Production deployment requires CI/CD and hardening evidence; local success alone is not release readiness.
- New roadmap items receive a phase record before implementation.
