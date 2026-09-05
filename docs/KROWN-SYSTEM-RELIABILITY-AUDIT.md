# KROWN System Reliability Audit

**Date:** 2026-09-06  
**Branch:** `security-audit-20260906`

## Current assessment

**NOT PRODUCTION READY YET.** Static reconciliation and database integrity checks show meaningful hardening progress, but runtime authentication, role, API, offline, financial and E2E suites have not yet produced the evidence required for a production declaration.

## Confirmed findings

### Authentication
- Prior work addressed a client/session hydration race.
- JWT fallback secrets have now been removed from both server auth and middleware.
- JWT issuer and algorithm are explicitly validated.
- Session validation now checks the current database identity, role, organization, branch and email.
- Super Admin sessions are resolved against `super_admins`, not tenant `staff`.

### Credential protection
- Newly-created staff credentials are hashed with Argon2id.
- Staff service responses no longer select credential columns.
- PIN reset clears the legacy plaintext PIN column.
- Production data still contains legacy credential fields and three staff records currently lack `pin_argon2`; a controlled reset/cleanup remains required.

### Tenant/branch isolation
- Organization filtering was broadly added in previous security work.
- Central branch access enforcement exists.
- Current non-destructive integrity checks found zero staff branch orphans and zero staff/product/category organization-branch mismatches.

### Database
- Every public application table currently has a primary key.
- `staff_pin_lockouts` retains its existing `staff_id` primary key and also has a UUID `id` with a unique index.
- Tenant/branch indexes were added through the security hardening migration.
- Categories RLS was changed from fail-open to fail-closed tenant behavior.

## Main remaining reliability risks

1. Client authentication still has legacy localStorage/offline paths and needs a deliberate reconciliation with the HttpOnly session architecture.
2. The frontend contains silent catches and legacy state patterns that can mask API errors.
3. The route surface is large and requires executable authorization tests rather than static inspection alone.
4. Offline mutation replay must prove idempotency under retries/timeouts.
5. Order/payment/inventory/accounting atomicity must be verified against the Neon HTTP driver's transaction limitations.
6. Device/session/MFA/OTP revocation behavior requires end-to-end verification.
7. Subscription mutation authorization must be proven Super Admin-only.
8. There is currently no dedicated test command in `package.json`; the test harness must be established before a production gate can pass.

## Evidence standard

A subsystem is not marked complete because files or routes exist. It becomes verified only after runtime behavior is exercised, expected status codes/data boundaries are checked, and a regression test exists where practical.
