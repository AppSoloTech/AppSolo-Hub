# API Contract

## Versioning And Media

- Base path: `/api/v1`
- Content type: `application/json`
- Dates: `YYYY-MM-DD`
- Timestamps: ISO 8601 UTC strings
- UUIDs: canonical string form
- Monetary and decimal values: JSON strings, never floating-point currency values

## Authentication Context

Business modules receive:

```ts
interface AuthenticatedUser {
  userId: string;
  email: string;
}
```

Development/test requests use `x-dev-user-id` after the browser establishes a local development identity. Middleware loads an active database user and creates the interface. Routes and services do not read the header directly.

The development mechanism is disabled outside development/test and must cause production startup failure when misconfigured.

## Standard Success Envelope

```json
{
  "data": {},
  "meta": {}
}
```

- `data` contains the resource or resource array.
- `meta` is always an object and contains count/pagination/request metadata when applicable.

## Standard Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be processed.",
    "details": []
  }
}
```

Error responses may also include a non-sensitive `requestId` either in `error` or response headers, but the placement must be consistent.

### Stable Error Codes

| Code                   | HTTP | Meaning                                                  |
| ---------------------- | ---: | -------------------------------------------------------- |
| `VALIDATION_ERROR`     |  400 | External input failed validation                         |
| `PAYLOAD_TOO_LARGE`    |  413 | Request body exceeds the configured size limit           |
| `UNAUTHENTICATED`      |  401 | No valid authenticated user context                      |
| `FORBIDDEN`            |  403 | Authenticated user lacks required tenant/project access  |
| `NOT_FOUND`            |  404 | Route or authorized resource not found                   |
| `CONFLICT`             |  409 | Request conflicts with current resource state            |
| `INVITATION_INVALID`   |  400 | Invitation is invalid, revoked, rotated, or already used |
| `INVITATION_EXPIRED`   |  410 | Pending invitation has passed its expiry                 |
| `DATABASE_UNAVAILABLE` |  503 | Health/readiness database check failed                   |
| `INTERNAL_ERROR`       |  500 | Unexpected internal failure                              |

Messages are safe for users. Raw exceptions, SQL, stack traces, environment values, and secrets are never returned.

## Request Correlation

- Accept a valid incoming `x-request-id` or generate one.
- Return it in `x-request-id`.
- Include it in structured request and error logs.
- Do not use a user-controlled request ID as a security decision.

## P001 Routes

### GET `/api/v1/health`

Purpose: process and database readiness.

Success `200`:

```json
{
  "data": {
    "status": "ok",
    "database": "ok"
  },
  "meta": {
    "timestamp": "2026-07-25T12:00:00.000Z"
  }
}
```

Database failure `503`:

```json
{
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "The service is temporarily unavailable.",
    "details": []
  }
}
```

The failure is logged internally without exposing the connection string or raw driver error.

### GET `/api/v1/projects/:projectId/change-requests`

Authorization: active membership in the project's active client organization and a role allowed to view project requests.

Query:

- `limit`: integer, default 25, minimum 1, maximum 100.
- `offset`: integer, default 0, minimum 0.

Ordering: `createdAt` descending, then `id` descending for stability.

Success `200`:

```json
{
  "data": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "submittedByUserId": "uuid",
      "title": "Add a dashboard export",
      "description": "Allow authorized users to export the dashboard as CSV.",
      "priority": "NORMAL",
      "status": "SUBMITTED",
      "requestedCompletionDate": "2026-08-15",
      "createdAt": "2026-07-25T12:00:00.000Z",
      "updatedAt": "2026-07-25T12:00:00.000Z"
    }
  ],
  "meta": {
    "count": 1,
    "limit": 25,
    "offset": 0
  }
}
```

Unauthorized access returns `403` and no project or request data.

### GET `/api/v1/change-requests/:changeRequestId`

Authorization: resolve the request's project and enforce active organization/project access before returning the DTO.

For this detail route, both a missing request and an inaccessible request return `404` so the API does not disclose cross-tenant resource existence.

Success `200`: standard envelope containing one change request.

P001 detail does not need to expose estimates, comments, time entries, attachments, or status history. Those remain separate future contracts.

### POST `/api/v1/projects/:projectId/change-requests`

Authorization: active membership with permission to submit a request for the project.

Request body:

```json
{
  "title": "Add a dashboard export",
  "description": "Allow authorized users to export the dashboard as CSV.",
  "priority": "NORMAL",
  "requestedCompletionDate": "2026-08-15"
}
```

Validation:

- `title`: trimmed, 3 to 160 characters;
- `description`: trimmed, 10 to 10000 characters;
- `priority`: one allowed priority; default `NORMAL` when omitted;
- `requestedCompletionDate`: optional nullable ISO calendar date;
- unknown fields: rejected or stripped consistently, with rejection preferred for external write payloads.

Server-owned fields:

- `projectId` from route;
- `submittedByUserId` from authenticated context;
- `status` = `SUBMITTED`;
- IDs and timestamps generated server-side.

Success `201`: standard envelope containing the created request.

The service inserts the request and initial status history in one transaction.

## Authorization Capabilities In P001

All active listed roles may view and submit requests when they hold an active membership in the client organization:

- `OWNER`
- `ADMIN`
- `DEVELOPER`
- `CLIENT_ADMIN`
- `CLIENT_MEMBER`

This simple capability set is deliberate for P001. Later phases may distinguish approval, administration, internal-note, and time-entry permissions.

## P002 Session And Access Routes

### POST `/api/v1/development/session`

Development/test only and unauthenticated. A strict body contains one normalized email. Only an active local user succeeds. Unknown, invited, and globally suspended users receive the same safe `401` denial. Success returns the session DTO; it does not issue a production credential, cookie, or password.

### GET `/api/v1/session`

Requires an authenticated active user. Returns:

- explicit application user identity;
- active memberships in active organizations, ordered by organization name and ID;
- organization role, membership version timestamp, and typed capabilities for each membership.

Suspended memberships are omitted. Provider claims and raw rows are never returned.

### Organization access administration

The following authenticated routes are tenant-scoped:

- `GET /organizations/:organizationId/members`;
- `PATCH /organizations/:organizationId/memberships/:membershipId`;
- `GET|POST /organizations/:organizationId/invitations`;
- `POST /organizations/:organizationId/invitations/:invitationId/resend`;
- `POST /organizations/:organizationId/invitations/:invitationId/revoke`;
- `GET /organizations/:organizationId/access-events`.

List routes accept the standard `limit`/`offset` pagination contract and have deterministic ordering. Membership updates accept exactly one of `role` or `status` plus `expectedUpdatedAt`; stale versions, self-suspension, and last-owner lockout return `409`. Inaccessible nested identifiers return `404`.

Invitation create accepts strict `firstName`, `lastName`, normalized `email`, and `role`. Create/resend returns an `acceptanceUrl` only in that authorized mutation response. The URL uses the validated `WEB_ACCEPTANCE_BASE_URL` (falling back to the first validated `CORS_ORIGIN` for compatible local configuration) and carries a 256-bit random token in its fragment. An authorized resend rotates the token and expiry and re-anchors its internal authorization snapshot to the resending administrator. List and other responses never contain the URL, plaintext token, token hash, or internal authorization snapshot.

### POST `/api/v1/invitations/accept`

Unauthenticated. Accepts only `{ "token": "..." }` in the JSON body. A valid token atomically activates an invited user, creates or reactivates membership, accepts the invitation, and records audit history. Role constraints use the authorization snapshot recorded when the current token was created or resent, plus the target membership's current role; they do not depend on the issuing administrator retaining a live membership afterward. Success returns the provider-neutral session DTO for local browser continuation.

Pending invitations expire seven days after create/resend. Expired tokens return `410 INVITATION_EXPIRED`; invalid, revoked, rotated, accepted, and unknown tokens share `400 INVITATION_INVALID`.

## P002 Capability Policy

All active organization roles retain `VIEW_CHANGE_REQUESTS` and `SUBMIT_CHANGE_REQUESTS`. `OWNER`, `ADMIN`, and `CLIENT_ADMIN` also receive `VIEW_MEMBERS`, `MANAGE_INVITATIONS`, `MANAGE_MEMBERSHIPS`, and `VIEW_ACCESS_EVENTS`, but assignment is constrained:

- `OWNER`: every role;
- `ADMIN`: `DEVELOPER`, `CLIENT_ADMIN`, `CLIENT_MEMBER`;
- `CLIENT_ADMIN`: `CLIENT_MEMBER`;
- `DEVELOPER` and `CLIENT_MEMBER`: none.

Internal organizations allow only `OWNER`, `ADMIN`, and `DEVELOPER`. Every route enforces policy server-side.

## Validation Ownership

- Shared Zod schemas define reusable external request/DTO contracts.
- React uses them for immediate form feedback.
- Express validates independently at the API boundary.
- Database constraints remain the final structural backstop.

Frontend validation never substitutes for API validation.

## CORS And Body Limits

- CORS allows only configured local web origins in development.
- Production must never default to `*` with authenticated traffic.
- JSON body size is explicitly limited; P001 target is 1 MiB or less.
- Attachment bodies are not accepted in P001.
