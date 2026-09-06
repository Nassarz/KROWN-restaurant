# KROWN Implementation Status

**Audit branch:** `security-audit-20260906`  
**Audit date:** 2026-09-06  
**Scope:** Existing KROWN Restaurant SaaS — reconciliation, security hardening, reliability and production-readiness audit.

## Status legend
- COMPLETE & VERIFIED — behavior or invariant was actually checked.
- IMPLEMENTED — NEEDS VERIFICATION — code exists but runtime behavior still needs execution testing.
- PARTIALLY IMPLEMENTED — meaningful layers exist, but one or more layers remain incomplete.
- BROKEN — known defect remains.
- NOT IMPLEMENTED — no trustworthy implementation found.
- REGRESSED — previously working behavior was damaged by later work.

## Current master status

| Subsystem | Status | Evidence / next action |
|---|---|---|
| Repository/Git reconciliation | COMPLETE & VERIFIED | Existing security branch and recent security/reliability commits reviewed. |
| Neon database discovery | COMPLETE & VERIFIED | Production project and public schema inspected. |
| Existing customer data integrity | COMPLETE & VERIFIED | Current tenant/branch relationship checks returned zero mismatches for staff, products and categories. |
| Authentication cryptography | IMPLEMENTED — NEEDS VERIFICATION | Argon2id + signed JWT with required `JWT_SECRET`; runtime login matrix still required. |
| Authentication session consistency | IMPLEMENTED — NEEDS VERIFICATION | Session now re-resolves tenant staff/platform admin and checks identity/role/branch/email. |
| Login UI reliability | PARTIALLY IMPLEMENTED | Prior hydration race fix exists; client still has duplicated cache/session effects and offline fallback that require cleanup and E2E verification. |
| Middleware JWT gate | IMPLEMENTED — NEEDS VERIFICATION | Production fallback removed; issuer/algorithm enforced. |
| RBAC | PARTIALLY IMPLEMENTED | Central role normalization/permission map exists; all route/page permission alignment still requires audit. |
| Tenant isolation | IMPLEMENTED — NEEDS VERIFICATION | Organization filters were broadly added in prior work; cross-tenant adversarial tests remain. |
| Branch isolation | IMPLEMENTED — NEEDS VERIFICATION | Central branch access helper + branch-scoped services exist; all resource routes still require matrix verification. |
| Products/categories/orders/branches | IMPLEMENTED — NEEDS VERIFICATION | Recent route/service hardening exists; runtime CRUD and denial tests remain. |
| Inventory | PARTIALLY IMPLEMENTED | Tables/services/routes exist; transaction/idempotency and branch-scope audit remains. |
| Expenses/accounting | PARTIALLY IMPLEMENTED | APIs and schema exist; financial transaction integrity needs runtime verification. |
| Companies/corporate credit | PARTIALLY IMPLEMENTED | CRUD/settlement exists; cross-branch and financial invariants need testing. |
| Devices/trusted devices | PARTIALLY IMPLEMENTED | Infrastructure exists; enrollment/revocation/session behavior needs complete verification. |
| Sessions/force logout | PARTIALLY IMPLEMENTED | Session tables/infrastructure exist; authoritative revocation path needs end-to-end verification. |
| MFA/OTP/password reset | PARTIALLY IMPLEMENTED | Tables/routes exist; full lifecycle and secret-handling audit remains. |
| Offline synchronization | PARTIALLY IMPLEMENTED | Queue/sync exists and prior auth-header fix exists; idempotency and duplicate-order tests remain. |
| Printing | PARTIALLY IMPLEMENTED | Print-job APIs/bridge exist; retry/deduplication behavior needs verification. |
| Support | PARTIALLY IMPLEMENTED | Support infrastructure exists; tenant/role/AI-grounding audit remains. |
| Subscriptions | PARTIALLY IMPLEMENTED | Plans/tenant subscriptions/limit checks exist; Super Admin-only mutation policy requires complete route audit. |
| Super Admin | PARTIALLY IMPLEMENTED | Dedicated routes/dashboard exist; all actions need live-data and permission verification. |
| Notifications | PARTIALLY IMPLEMENTED | Infrastructure exists; recipient/tenant/deduplication behavior needs audit. |
| Feature flags | PARTIALLY IMPLEMENTED | Infrastructure exists; server-side enforcement needs audit. |
| API contracts | PARTIALLY IMPLEMENTED | Mixed response shapes remain; standard contract document is being established. |
| Frontend loading/error states | PARTIALLY IMPLEMENTED | ErrorBoundary and prior cache fixes exist; silent-failure audit remains. |
| Automated test suite | BROKEN / INCOMPLETE | `package.json` currently exposes build/lint scripts but no dedicated test scripts; test inventory must be established. |
| Production build | IMPLEMENTED — NEEDS VERIFICATION | Prior commit reported a build fix; must be run again after current changes. |
| Observability | PARTIALLY IMPLEMENTED | Some logs/audit/security tables exist; correlation/request logging needs verification. |
| Backup/recovery documentation | NOT IMPLEMENTED / NEEDS VERIFICATION | Neon recovery capability exists, but KROWN-specific recovery runbook is not yet verified. |

## Database snapshot observed during audit

The production Neon project currently has one application branch and the following public tables were enumerated: organizations, branches, staff, products, categories, orders, inventory/ingredients, expenses/accounting, devices/sessions/security, support, notifications, subscriptions and related tables. The database also contains Neon Auth tables in the `neon_auth` schema.

Earlier verified application counts were: 1 organization, 1 branch, 4 staff, 115 products and 3 orders.

## Verified integrity checks

The following checks were previously executed non-destructively and returned **0**:

- staff with orphaned branches
- staff organization/branch mismatches
- product organization/branch mismatches
- category organization/branch mismatches

A UUID `id` was added to `staff_pin_lockouts` while preserving its existing `staff_id` primary key and data.

## Highest-priority remaining work

1. Execute the real authentication matrix and reproduce the intermittent login/visibility failure.
2. Remove unsafe client identity/cache assumptions without breaking offline ordering.
3. Complete route-by-route tenant/branch/RBAC audit.
4. Complete staff/device/session/PIN reset lifecycle and revocation tests.
5. Complete orders → inventory → payment/accounting transactional/idempotency audit.
6. Complete Super Admin and subscription mutation authorization.
7. Establish executable unit/integration/API/E2E/security test suites.
8. Run lint/type/build and runtime smoke tests.
9. Complete all six required architecture/reliability/ledger documents.
10. Do not declare production-ready until critical tests pass with evidence.

## Production readiness statement

**NOT PRODUCTION READY YET.** The codebase has substantial security and reliability work already implemented, including important tenant-isolation and authentication hardening, but the complete runtime test matrix and remaining subsystem audits have not yet been executed to the standard required by this directive.
