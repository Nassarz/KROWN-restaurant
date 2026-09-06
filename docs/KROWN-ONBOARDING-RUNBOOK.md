# KROWN Restaurant Onboarding Runbook

## Before activating a restaurant
- Confirm organization identity and primary Restaurant Admin.
- Create the organization and first branch.
- Confirm subscription plan and server-side limits.
- Create Restaurant Admin using a temporary credential/reset flow; never record plaintext credentials in support notes.
- Add additional branches only through authorized server APIs.
- Create branch-scoped staff and verify assigned branch.
- Import/create categories, products, ingredients and pricing.
- Configure tax, receipt, payment and printing settings.
- Configure devices/printers and test a sample receipt.
- Perform one complete test sale before opening service.

## Opening-service smoke test
1. Admin login.
2. Cashier login.
3. Load branch products/categories.
4. Create an order.
5. Confirm kitchen/print flow if enabled.
6. Complete payment.
7. Confirm receipt.
8. Confirm inventory deduction.
9. Confirm accounting/audit entry.
10. Confirm dashboard/report totals.
11. Verify another branch cannot see the sale.

## Multi-branch acceptance
For each branch, independently verify:
- staff assignment;
- product/category visibility;
- order creation;
- inventory movements;
- expenses;
- companies/corporate credit;
- printing;
- reports;
- audit records.

A branch-scoped employee must never be able to substitute another branch ID in an API request to access or mutate another branch.

## Incident response
If payment, order, inventory or authentication behaves unexpectedly:
- stop further financial testing;
- preserve timestamps and order/reference IDs;
- do not manually edit financial rows to hide the issue;
- inspect audit logs and server/database logs;
- use the documented rollback/recovery procedure;
- escalate to platform support.

## Go-live rule
Do not activate a paying restaurant until the Production Gate is green for P0 and the onboarding smoke test passes for the restaurant's actual branch configuration.
