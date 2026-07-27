# External Integration Boundaries

## Purpose

P001 defines provider-neutral seams for future AWS services without importing AWS SDK packages or pretending those integrations exist.

## Authentication Adapter

Provider-specific middleware must produce:

```ts
interface AuthenticatedUser {
  userId: string;
  email: string;
}
```

- P001/P002 implementation: development-only database-backed adapter. P002 adds normalized-email identity selection, browser-local user-ID state, and a provider-neutral session DTO.
- Future implementation: Cognito JWT adapter in P008.
- Business services depend only on authenticated application identity and authorization services.
- Invitation acceptance returns local session data but does not create a provider credential. P008 will bind accepted application users to Cognito identity without changing the business-facing `AuthenticatedUser`.

## Attachment Storage

P001 creates a service interface similar to:

```ts
interface AttachmentStorage {
  createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget>;
  createDownloadTarget(input: CreateDownloadTargetInput): Promise<DownloadTarget>;
  deleteObject(storageKey: string): Promise<void>;
}
```

Exact method names may change during implementation, but the boundary must:

- use application-owned input/output types;
- avoid AWS types in callers;
- avoid accepting tenant authorization as an implicit storage concern;
- separate metadata persistence from object storage;
- have no operational upload route or S3 implementation in P001.

Authorization occurs before the storage adapter is called. A future S3 implementation belongs to P006.

## Email Delivery

P002 uses copy-only local invitation links and introduces no email adapter, outbox, or simulated delivery. P007 will define event, preference, template, and SES behavior.

When introduced, domain/use-case code should call a provider-neutral notification boundary rather than the SES client directly.

P004 persists append-only request comments with stable request, author,
visibility, ID, and creation time. That durable row is notification-ready input,
not a delivery claim. P004 adds no outbox, preference, template, email adapter,
queue, webhook, or provider integration; those decisions remain P007 scope.

## Logging And Monitoring

P001 emits structured application logs through Pino. Business modules do not call CloudWatch APIs.

CloudWatch collection/configuration belongs to P009. The log schema should remain usable outside AWS.

## Secrets

P001 reads validated environment variables. Business modules do not call Secrets Manager.

A future runtime composition layer may resolve secrets before constructing application dependencies.
