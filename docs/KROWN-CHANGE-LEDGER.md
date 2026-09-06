# KROWN Change Ledger

## 2026-09-06 — Security/reliability reconciliation

### Issue
Existing KROWN contained tenant/branch authorization gaps, inconsistent authentication paths, plaintext credential storage in staff service paths, and a middleware JWT development fallback.

### Root cause
Security responsibilities had accumulated across legacy RBAC, route handlers, services, localStorage/offline state and older authentication conventions. Some code trusted client-derived context or returned broad database rows.

### Changes
- Added centralized branch authorization helper.
- Hardened product/order/branch/category route and service scoping.
- Hardened JWT verification and removed the JWT development fallback.
- Enforced issuer and HS256 algorithm checks.
- Made session resolution authoritative against current staff/platform-admin records.
- Added explicit Super Admin session handling.
- Fixed an authentication/manager-visibility contract mismatch: auth responses exposed `assignedBranchId` while the login UI was reading `assigned_branch_id`; the response now carries both compatible field names plus status/org fields.
- Stopped staff service from storing newly-created plaintext passwords/PINs.
- Stopped staff responses from selecting credential columns.
- Staff PIN reset now stores Argon2id only and clears legacy plaintext PIN for that record.
- Added branch scope to staff listing and hardened the legacy staff-management endpoint.
- Bound order actor attribution to the authenticated session instead of request-body `staffId`.
- Added branch authorization to inventory movement and company endpoints.
- Added master implementation status and permission/API documentation.
- Added/retained database hardening migration for category fail-closed RLS, tenant/branch indexes and lockout UUID.

### Database
The hardening migration was previously prepared/tested on a temporary Neon branch and applied to the production parent. No tables or customer records were dropped.

### Verification
Non-destructive integrity checks returned zero for staff branch orphans, staff organization/branch mismatch, product organization/branch mismatch and category organization/branch mismatch. All public application tables currently report a primary key.

### Known remaining risk
Production data currently contains legacy credential columns: all four staff records have a legacy `password_hash` value and `pin_code`; three staff records lack `pin_argon2`. The application no longer authenticates against plaintext values, but a controlled credential-cleanup/reset operation is still required. Do not expose the values in logs or UI.

Orders also have a unique `idempotency_key` database index, but the current order service does not yet consume that field during creation; offline/timeout duplicate prevention therefore remains incomplete until the service path is wired to it.

### Tests still required
Full auth E2E, role matrix, cross-tenant/branch adversarial tests, API route matrix, offline idempotency tests, order/inventory/accounting integrity tests, and production build/lint/type checks.

### Risk
High until runtime security and regression suites are executed. Changes are isolated on `security-audit-20260906`; do not merge to production based only on static review.
