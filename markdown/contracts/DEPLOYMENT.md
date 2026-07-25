# Deployment Contract

## Current Phase

P001 is local-only.

The application must run with Node.js, pnpm, Docker Compose, and local PostgreSQL. No AWS account, credentials, SDK, resource, or network dependency is required.

## Planned AWS Topology

| Concern | Planned AWS Service |
| --- | --- |
| React hosting | AWS Amplify Hosting |
| API image registry | Amazon ECR |
| API runtime | ECS Express Mode or ECS Fargate |
| Relational database | Amazon RDS for PostgreSQL |
| Authentication | Amazon Cognito |
| Attachments | Amazon S3 |
| Runtime secrets | AWS Secrets Manager |
| Logs and monitoring | Amazon CloudWatch |
| Transactional email | Amazon SES |
| Deployment identity | GitHub Actions with AWS OpenID Connect |

This table is direction, not authorization to provision resources.

## Portability Boundaries

- API configuration comes from validated environment variables.
- Authentication is an adapter that produces `AuthenticatedUser`.
- Attachment storage is an interface with no AWS implementation in P001.
- Email is a future interface with no provider implementation in P001.
- Logging uses structured application events that can later flow to CloudWatch without embedding CloudWatch calls in domain code.
- Database access uses standard PostgreSQL and Drizzle behavior compatible with local Postgres and RDS.

## Container Direction

P001 may create local development containers only for PostgreSQL.

The production API Dockerfile, ECR build, ECS task/service configuration, load balancing, health checks, and runtime IAM belong to P009/P010 unless a human-approved prompt changes sequencing.

## Migration Direction

- Migrations are generated and committed.
- Development migration commands are explicit.
- Production migrations will run as an explicit release step or one-off task, not as unreviewed schema mutation during every API startup.
- Destructive migrations require backup/recovery planning and explicit human approval.

## Environment Direction

At minimum, future cloud work should separate:

- local;
- test/CI;
- non-production AWS environment;
- production AWS environment.

AWS account layout, region, VPC strategy, RDS accessibility, domain, certificates, cost budgets, and disaster recovery are open human decisions for P009.

## CI/CD Direction

Future GitHub Actions should:

- use OIDC, not long-lived AWS access keys;
- run lint, typecheck, tests, and builds before deployment;
- publish immutable API images;
- identify the deployed commit;
- use protected environments for production;
- run migrations with explicit evidence;
- preserve rollback options.

No workflow should be created in P001 merely as a placeholder deployment.
