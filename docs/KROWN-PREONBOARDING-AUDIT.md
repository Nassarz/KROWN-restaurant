# KROWN Pre-Onboarding Audit Findings

## Current conclusion
The security-audit branch contains substantial hardening, but production onboarding is blocked until runtime evidence proves authentication, authorization, financial atomicity, idempotency, offline replay and operational recovery.

## Immediate blockers
1. Execute clean build/lint/typecheck and establish an executable test suite.
2. Wire order idempotency through the service/database path so retries cannot create duplicate sales.
3. Make offline sync queue only transient network/5xx failures; never queue 401/403 authorization failures.
4. Verify order → inventory → payment → accounting atomicity and concurrent behavior.
5. Complete legacy PIN migration/reset for existing staff without exposing credential values.
6. Complete session/device revocation and MFA/OTP lifecycle tests.
7. Complete Super Admin/subscription mutation authorization audit.
8. Execute cross-tenant and cross-branch adversarial API tests.

## Already verified
- Live Neon database is reachable.
- Tenant/branch integrity checks performed during the audit returned zero mismatches for the audited business tables.
- All public application tables have primary keys after the security migration work.
- New staff creation hashes password and PIN values.
- The login branch-context field mismatch was identified and corrected.
- Protected resource routes have received significant tenant/branch authorization hardening.

## Operational requirements before first paying customer
- Production environment secrets validated and no insecure defaults.
- HTTPS and secure cookie behavior verified in the actual deployment.
- Database backups/recovery procedure verified.
- Monitoring and alerting active.
- Support escalation and incident procedure documented.
- Restaurant onboarding smoke test completed.

## Release discipline
All fixes are being made on `security-audit-20260906`. Do not merge into `main` until the production gate is green and an explicit release decision is made.
