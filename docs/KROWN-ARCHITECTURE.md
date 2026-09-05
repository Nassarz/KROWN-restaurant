# KROWN Architecture

## Application

KROWN is an existing Next.js App Router application with React/TypeScript UI, Next.js API routes, server-side services, Neon PostgreSQL, and client-side caching/offline synchronization.

## Request path

Browser UI → typed client (`lib/neon-client.ts`) / direct auth request → Next.js API route → verified auth/session context → RBAC/resource-scope checks → service layer → parameterized Neon SQL → response → client state/cache.

Middleware performs the first cryptographic JWT gate. It does not replace route-level database-backed authorization.

## Authentication

Tenant staff authenticate with Argon2id password or PIN verification. A signed HS256 JWT is issued in the `krown_session` HttpOnly cookie. The current session is re-resolved against the database so role, organization, branch and email changes invalidate stale tokens. Platform Super Admins are stored separately and use a dedicated platform identity with a zero UUID tenant claim.

## Authorization

`lib/rbac.ts` is the central role/permission normalization source. `lib/access-control.ts` enforces branch ownership/assignment. Resource services also include organization filters. Frontend visibility is not a security boundary.

## Tenant model

Tenant-owned records carry `organization_id`. Branch-owned records generally carry `branch_id`; orders historically use `restaurant_id` as the branch identifier and this schema contract is preserved. Branch-scoped roles are restricted to their assigned branch.

## Database

Neon PostgreSQL contains application tables for organizations, branches, staff, products, categories, orders, inventory, expenses/accounting, devices/sessions/security, support, notifications and subscriptions. Versioned SQL migrations are stored under `migrations/`.

## IDs

Internal UUID-style IDs are preserved. Existing historical IDs must never be regenerated. Where public reference IDs exist, they should remain stable and unique.

## Offline synchronization

`lib/dataStore.ts` provides a client cache and routes writes through authenticated APIs. Offline operations are queued for replay by the sync engine. Duplicate-prevention/idempotency remains a production-readiness test requirement.

## Printing

Print jobs are represented in the application database and consumed by the existing print bridge. Retry/deduplication behavior remains under audit.

## Billing/subscriptions

`subscription_plans` and `tenant_subscriptions` exist and are used by server-side limit checks. Customer self-service billing is not the current product model; subscription administration should remain a platform/Super Admin capability.

## Support

Support conversations/messages and related AI/support infrastructure exist in the application. Tenant scoping and AI grounding require verification before production claims.

## Deployment

Neon branching is available for schema testing. Risky schema changes should follow expand → migrate → verify → switch → contract. Production should not receive untested schema changes.

## Reliability principle

Authentication, authorization and data integrity are server authoritative. UI state distinguishes authentication/loading/error states and should never erase tenant data merely because a fetch failed.
