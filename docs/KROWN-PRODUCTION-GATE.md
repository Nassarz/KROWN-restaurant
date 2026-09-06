# KROWN Production Gate

**Branch:** `security-audit-20260906`
**Purpose:** Final operational gate before onboarding paying restaurants.

## Release rule
KROWN must not be advertised as production-ready until all P0/P1 gates below have executable evidence. Code inspection alone is insufficient.

## P0 — must pass
- [ ] Login succeeds deterministically for Super Admin, Restaurant Admin, Branch Manager, Cashier and Waiter.
- [ ] Invalid/expired/revoked sessions fail closed without redirect loops.
- [ ] Tenant isolation: organization A cannot read/write organization B.
- [ ] Branch isolation: branch A staff cannot read/write branch B resources.
- [ ] RBAC: every protected mutation is permission checked server-side.
- [ ] Staff credentials: no new plaintext password/PIN storage; legacy credentials have a safe reset/migration path.
- [ ] Order creation is atomic and idempotent; retry cannot create a duplicate sale.
- [ ] Inventory deduction and accounting effects are transactionally consistent with orders.
- [ ] Payment state transitions are validated server-side and cannot be forged by the client.
- [ ] Offline sync never queues/replays 401/403 operations; replay is authenticated and idempotent.
- [ ] Production build completes from a clean install.
- [ ] Lint/typecheck/tests complete with zero failures.

## P1 — must pass before broad onboarding
- [ ] Device enrollment, approval, revocation and trusted-device expiry verified.
- [ ] Force logout/session revocation verified.
- [ ] MFA/OTP/password reset lifecycle verified for expiry, attempts, reuse and secret handling.
- [ ] Super Admin subscription mutation is restricted to platform administrators.
- [ ] Restaurant Admin can view subscription status but cannot mutate billing/subscription state.
- [ ] Plan limits are enforced server-side for branches/staff and other metered resources.
- [ ] Printing retries are safe and do not duplicate receipts/jobs.
- [ ] Audit logs are generated for authentication, staff, permissions, orders, payments, inventory and subscription changes.
- [ ] Support tools are tenant/role scoped and do not expose cross-tenant data.
- [ ] Notifications and feature flags are tenant scoped and server enforced.
- [ ] Error responses do not leak secrets, credential hashes or sensitive internals.

## P2 — operational hardening
- [ ] Health endpoint covers database and required dependencies.
- [ ] Monitoring/alerting exists for database errors, auth failures, queue failures and payment/order anomalies.
- [ ] Backup/recovery procedure is documented and periodically tested.
- [ ] Rate limits exist for login, PIN, OTP, password reset and sensitive admin mutations.
- [ ] Security headers, cookie flags and CSRF posture are verified in the deployed environment.
- [ ] Production environment variables are validated at startup; no insecure defaults.
- [ ] Deployment rollback procedure is documented.
- [ ] Restaurant onboarding runbook and support escalation path are documented.

## Required acceptance scenarios
1. Create organization → create multiple branches → create staff per branch.
2. Log in as each role and verify only permitted navigation/data/actions are available.
3. Create products/categories/ingredients per branch and verify isolation.
4. Create order → pay → close → receipt → inventory deduction → accounting entry.
5. Retry the same order request and verify exactly one order.
6. Disconnect network → create permitted offline operation → reconnect → sync once.
7. Disconnect network → attempt unauthorized operation → verify it is not queued.
8. Revoke a session/device → verify existing session can no longer access protected APIs.
9. Attempt cross-tenant and cross-branch reads/writes using direct API calls.
10. Exercise subscription limits and verify server-side rejection.

## Evidence standard
Every checked gate should record command/query/test name, result, timestamp and commit SHA in `KROWN-CHANGE-LEDGER.md`. A green UI screenshot is not sufficient evidence for authorization or financial correctness.
