# KROWN API Contract

## Authentication

Protected API routes derive identity from the verified `krown_session` HttpOnly cookie or an explicitly supplied Bearer token. Client-provided `user_id`, `staff_id`, `organization_id`, `branch_id`, or `role` values are never authoritative.

## Response contract

New/updated endpoints should use:

```json
{ "success": true, "data": {} }
```

or:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

Legacy endpoints currently return `{ data, error }` and are being migrated only when touched. Do not create a second API abstraction solely for formatting.

## HTTP semantics

- `200` successful read/update
- `201` successful creation
- `400` malformed/invalid input
- `401` missing, invalid or expired authentication
- `403` authenticated but not authorized for role/tenant/branch/resource
- `404` resource does not exist within the caller's visible scope
- `409` uniqueness/state conflict
- `422` semantically invalid business input where appropriate
- `429` rate limited
- `500` unexpected server error
- `502/503` upstream/dependency unavailable

Never return HTTP 200 for a failed authorization or database operation.

## Mutation rules

Unsafe mutations must not be automatically retried by the client. Offline replay must use stable client operation IDs/idempotency keys where duplicate creation is possible.

## Tenant and branch scope

Every tenant-owned query must include the authenticated organization scope. Branch-scoped roles must also be restricted to their assigned branch. Query parameters are filters, not authorization.

## Errors

Server logs may contain diagnostic context but never passwords, PINs, JWTs, OTPs, MFA secrets, API keys or database credentials. Client errors expose actionable messages without SQL/internal stack traces.

## Current migration note

The codebase contains legacy response shapes. The priority is behavioral correctness and security first; response-shape normalization should be performed incrementally with frontend compatibility preserved.
