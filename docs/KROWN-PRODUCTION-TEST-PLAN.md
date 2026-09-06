# KROWN Production Test Plan

Run against a disposable test organization/branch and the current deployment before production onboarding. Never use destructive tests against customer data.

## Authentication
- valid login for each supported role;
- wrong password/PIN;
- expired token;
- malformed token;
- revoked session;
- changed role/branch after token issuance;
- cookie-only request;
- concurrent login/logout;
- refresh/reload after login;
- login followed immediately by protected API access.

## Authorization
For every protected resource test:
- same-tenant/same-branch allowed;
- same-tenant/wrong-branch denied;
- wrong-tenant denied;
- missing permission denied;
- direct API call denied even if UI hides the action.

## Orders and money
- valid order;
- invalid item/product/quantity;
- client price tampering;
- invalid discount/tax/payment amount;
- duplicate idempotency key;
- concurrent duplicate submission;
- payment replay;
- cancellation/refund authorization;
- order + inventory + accounting atomicity;
- report totals after completion.

## Offline
- network loss during create;
- network loss after server acceptance but before client response;
- reconnect and replay;
- duplicate replay;
- 401/403 while offline;
- expired session while queued;
- branch changed before replay.

## Inventory
- receiving/adjustment/transfer where supported;
- insufficient stock;
- concurrent deductions;
- wrong-branch movement;
- order cancellation/refund effect;
- audit trail.

## Staff/devices/security
- staff creation and branch assignment;
- role restrictions;
- password reset;
- PIN reset/lockout;
- device enrollment/approval/revocation;
- forced logout;
- MFA/OTP expiry and attempt limits.

## Billing/platform
- plan visibility;
- branch/staff limits;
- Super Admin subscription mutation;
- Restaurant Admin mutation denied;
- expired/suspended subscription behavior;
- support access tenant isolation.

## Reliability
- clean install/build;
- lint/typecheck;
- API smoke tests;
- database connectivity;
- print job retry/deduplication;
- browser refresh and session persistence;
- empty/loading/error/403/404 states;
- database backup/recovery exercise.

## Release evidence
Record exact test command, environment, commit SHA, timestamp, pass/fail count and any known exceptions. Do not mark production-ready on manual inspection alone.
