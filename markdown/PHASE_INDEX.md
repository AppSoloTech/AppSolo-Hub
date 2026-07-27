# Phase Index

> Generated from `markdown/phases/*.md` by `node scripts/generate-phase-index.mjs`.
> Do not edit phase status here; edit the canonical phase record and regenerate.

| Phase                                                                     | Title                                              | Status     | Risk   | Depends On | Prompt                                                                                        |
| ------------------------------------------------------------------------- | -------------------------------------------------- | ---------- | ------ | ---------- | --------------------------------------------------------------------------------------------- |
| [P001](phases/P001-local-foundation-and-change-request-vertical-slice.md) | Local Foundation And Change-Request Vertical Slice | `complete` | high   | []         | [active prompt](../prompts/active/P001-local-foundation-and-change-request-vertical-slice.md) |
| [P002](phases/P002-authentication-and-invitations.md)                     | Authentication And Invitations                     | `complete` | high   | [P001]     | [active prompt](../prompts/active/P002-authentication-and-invitations.md)                     |
| [P003](phases/P003-estimates-and-approval-workflow.md)                    | Estimates And Approval Workflow                    | `complete` | high   | [P002]     | [active prompt](../prompts/active/P003-estimates-and-approval-workflow.md)                    |
| [P004](phases/P004-comments-and-clarification.md)                         | Comments And Clarification                         | `approved` | high   | [P003]     | [active prompt](../prompts/active/P004-comments-and-clarification.md)                         |
| [P005](phases/P005-time-tracking-status-and-completion.md)                | Time Tracking, Status, And Completion              | `draft`    | high   | [P004]     | Not drafted                                                                                   |
| [P006](phases/P006-attachments-with-s3.md)                                | Attachments With S3                                | `draft`    | high   | [P005]     | Not drafted                                                                                   |
| [P007](phases/P007-email-notifications-with-ses.md)                       | Email Notifications With SES                       | `draft`    | medium | [P006]     | Not drafted                                                                                   |
| [P008](phases/P008-cognito-integration.md)                                | Cognito Integration                                | `draft`    | high   | [P007]     | Not drafted                                                                                   |
| [P009](phases/P009-aws-runtime-infrastructure.md)                         | AWS Runtime Infrastructure                         | `draft`    | high   | [P008]     | Not drafted                                                                                   |
| [P010](phases/P010-ci-cd-and-release-automation.md)                       | CI/CD And Release Automation                       | `draft`    | high   | [P009]     | Not drafted                                                                                   |
| [P011](phases/P011-production-hardening-and-launch-readiness.md)          | Production Hardening And Launch Readiness          | `draft`    | high   | [P010]     | Not drafted                                                                                   |

## Active Work

- **P004 — Comments And Clarification**: `approved`.
