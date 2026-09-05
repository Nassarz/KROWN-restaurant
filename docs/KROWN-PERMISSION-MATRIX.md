# KROWN Permission Matrix

This is the working authorization contract. Backend checks are authoritative; frontend navigation is only a usability layer.

| Role family | Tenant scope | Branch scope | Expected authority |
|---|---|---|---|
| `super_admin` | Platform-wide | All | Platform operations, security, support, billing/subscription management |
| `platform_admin` | Platform-wide | All | Platform operations granted by permission map |
| `security_admin` | Platform-wide | All | Security/audit operations granted by permission map |
| `support_admin` | Platform-wide | All | Support operations granted by permission map |
| `support_agent` | Platform support | All | Support operations granted by permission map |
| `billing_admin` | Platform-wide | All | Billing/subscription operations granted by permission map |
| `read_only_analyst` | Platform-wide | All | Read-only analytics/audit/reporting |
| `restaurant_admin` | Own organization | All own branches | Restaurant administration and business operations |
| `manager` / `branch_manager` | Own organization | Assigned branch | Branch operations; cannot cross branches |
| `cashier` | Own organization | Assigned branch | POS/order/payment operations granted by map |
| `waiter` / `senior_waiter` | Own organization | Assigned branch | POS/order operations granted by map |
| `kitchen_staff` / `head_chef` | Own organization | Assigned branch | Kitchen/order/inventory read operations granted by map |

## Rules

1. Identity comes from the verified session/JWT, never from request body/query/header identity fields.
2. Organization ownership is checked for resource access.
3. Branch-scoped roles must match their assigned branch.
4. A frontend branch selector cannot elevate branch access.
5. `super_admin` uses a platform identity and must not be coerced into a tenant organization.
6. Role aliases are normalized centrally (`Branch Manager` → `manager`, `Head Chef` → `kitchen_staff`, etc.).
7. Subscription mutations are platform/Super Admin operations; restaurant users may only consume plan/limit behavior exposed to their role.
8. Direct URL access must be denied server-side even if navigation hides the page.

## Current permission source

`lib/rbac.ts` is the central permission map and normalization layer. Route handlers additionally enforce resource-specific organization/branch ownership.

## Verification required

The matrix still requires automated role-by-role E2E/API tests against every supported route. Until those tests execute successfully, this document must not be interpreted as proof that every role is production-ready.
