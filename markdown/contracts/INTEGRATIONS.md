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

- P001 implementation: development-only database-backed adapter.
- Future implementation: Cognito JWT adapter in P008.
- Business services depend only on authenticated application identity and authorization services.

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

No email interface is required in P001 unless it creates immediate clarity without unused production code. P007 will define event, preference, template, and SES behavior.

When introduced, domain/use-case code should call a provider-neutral notification boundary rather than the SES client directly.

## Logging And Monitoring

P001 emits structured application logs through Pino. Business modules do not call CloudWatch APIs.

CloudWatch collection/configuration belongs to P009. The log schema should remain usable outside AWS.

## Secrets

P001 reads validated environment variables. Business modules do not call Secrets Manager.

A future runtime composition layer may resolve secrets before constructing application dependencies.
