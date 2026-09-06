# KROWN Device Authentication & Production Audit

Date: 2026-09-06
Branch: `security-audit-20260906`

## Executive result

**NOT YET PRODUCTION READY.** This audit is based on the repository and the live Neon production database, not prior documentation claims.

The existing device subsystem is real but incomplete. It currently identifies devices primarily by a browser fingerprint and has enrollment-token records, device status/trust state, audit hooks, and device-management APIs. It does **not** yet provide a cryptographic device credential, branch-bound device identity, or device-bound staff PIN authentication.

A data-preserving migration and application layer for personal credit plus stronger device identity has been prepared on the working branch and validated on a temporary Neon branch. It has **not been applied to production** pending explicit database-migration approval.

## Verified repository state

- KROWN uses Next.js 15, React 19, Neon serverless Postgres, Argon2, `jose`/`jsonwebtoken`, and IndexedDB (`idb`).
- Authentication currently issues a KROWN JWT and an HttpOnly `krown_session` cookie.
- Staff PIN login currently accepts email + PIN and checks Argon2 PIN hash and `staff_pin_lockouts`.
- PIN login does not currently require an enrolled device.
- Existing device APIs use `extractTenantContext` and allow browser-supplied `deviceFingerprint` values.
- Existing `devices` has organization scope but no branch binding and no cryptographic public-key credential.
- Existing device enrollment stores a SHA-256 enrollment token hash, but the current enrollment model does not enforce the requested full short-lived single-use lifecycle at the API/service level.
- Existing device management supports pending/active/suspended/revoked, but not the requested decommissioned state.
- The existing RBAC contains device permissions and restaurant/platform roles.
- There is no `bar` device type in the current schema. Supported types are `pos`, `kitchen`, `waiter_tablet`, `manager_desk`, `admin_desk`, and `general`.

## Live Neon verification

Project: `nameless-waterfall-94763030`
Production branch: `br-young-river-b2p27wrc`
Database: `neondb`

Observed production data at audit time:

- devices: 1
- device enrollment tokens: 0
- sessions: 0
- staff sessions: 0
- security alerts: 0
- audit logs: 29
- orders: 3
- organizations: 1
- branches: 1

The only existing device was already revoked. It had no enrollment timestamp or branch assignment. Its historical row is preserved.

## Critical gaps

### P0

1. PIN authentication is not device-bound.
2. Device identity is fingerprint-based rather than cryptographic.
3. Devices do not currently carry a required branch binding.
4. Enrollment currently creates/updates a device directly rather than using a complete administrator-approved one-time enrollment state machine.
5. Enrollment expiration is stored on `device_enrollment_tokens`, but the current device-service flow shown in the repository stores enrollment state on `devices` and does not consume the dedicated token table.
6. Staff sessions are not yet proven to be bound to device identity.
7. Offline authentication is not yet proven safe for unknown devices.
8. The current order idempotency database constraint is not yet consumed by order creation.
9. Offline queue behavior must not replay 401/403/validation failures.
10. Runtime production build/E2E evidence is still required.

### P1

- device heartbeat and risk signals need completion
- immediate session invalidation on device revoke needs runtime verification
- staff disablement/session invalidation needs runtime verification
- personal-credit UI and order integration need completion
- dashboard KPI UI integration needs completion
- Super Admin device and personal-credit views need completion
- CI/test suite needs actual passing evidence

## Personal credit implementation added on working branch

A separate personal-credit model is being introduced rather than overloading corporate accounts:

- `personal_credit_profiles`: customer identity, branch, credit limit, current balance, status
- `personal_credit_ledger`: immutable charge/payment history tied to profile and optionally order
- orders gain `personal_credit_profile_id` and `is_personal_credit`
- manager/restaurant-admin authorization is required to create/manage profiles
- Super Admin visibility is supported at the service/API layer
- every profile and ledger row is tenant + branch scoped
- profile history returns linked order item JSON and order timestamps

The production migration is data-preserving and does not delete existing records.

## Dashboard metrics

A server-authoritative `/api/dashboard/metrics` endpoint has been added for authorized restaurant admins, managers, cashiers, and Super Admin. It is designed to expose today’s:

- meals sold
- kitchen orders sent
- kitchen orders ready
- cashier amount received
- total sales amount
- paid/unpaid orders
- personal-credit sales
- corporate-credit sales

The UI still needs to consume this endpoint in each requested dashboard.

## Security architecture decision

The target model is:

`Device credential → device → organization → branch → staff → role → permission → resource`

Browser-supplied organization, branch, staff, or device identifiers are not authoritative.

The recommended credential direction is Web Crypto/WebAuthn-compatible non-exportable key material where browser/runtime support is adequate. If the existing POS environment cannot guarantee that capability, the fallback must use the strongest device-bound credential available and explicitly document the residual cloning risk.

## Release gate

Do not mark KROWN production-ready until all P0 items have executable evidence: clean build, lint/typecheck, API security tests, cross-tenant/branch tests, device enrollment tests, PIN/device binding tests, revocation tests, offline tests, order idempotency tests, personal-credit accounting tests, and real production-like E2E smoke tests.
