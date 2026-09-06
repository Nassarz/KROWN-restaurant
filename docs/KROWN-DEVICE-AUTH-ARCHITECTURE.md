# KROWN Device Authentication Architecture

## Security model

KROWN treats the physical POS device as a security principal. A valid staff PIN is never sufficient by itself for operational POS access.

`device credential → device → organization → branch → staff → role → permission → resource`

The server is authoritative for every identity link.

## Device lifecycle

`PENDING_ENROLLMENT → ACTIVE → SUSPENDED → ACTIVE`

Terminal states:

`REVOKED` and `DECOMMISSIONED`

Revocation preserves historical records and immediately invalidates device authorization and associated operational sessions.

## Enrollment

1. An authorized administrator creates a short-lived enrollment request for an organization and branch.
2. The request contains only a high-entropy, single-use reference suitable for QR transfer.
3. The new device generates its cryptographic credential locally.
4. The server verifies the enrollment request and records only the public credential material.
5. The device becomes branch-bound and active after successful completion.
6. The enrollment reference is consumed and cannot be reused.

Long-lived secrets/private keys are never placed in a QR code.

## Restaurant and branch resolution

After device authentication, the server resolves organization and branch from the device record. Client-supplied organization/branch identifiers are advisory only and must not override authenticated context.

## Staff PIN flow

`device authentication → restaurant/branch resolution → staff PIN → Argon2id verification → lockout checks → staff authorization → device-bound staff session`

The session records the staff, organization, branch, device, role, issuance/expiry, activity and revocation state.

## Staff switching

A physical POS may be shared. Switching staff terminates the previous operational staff session and creates a fresh session for the new staff member on the same authenticated device.

## Offline behavior

Only previously authorized devices may enter approved offline operation. Unknown devices cannot bootstrap operational access offline. Offline authorization must expire and all queued writes must be idempotent and auditable when synchronized.

## Personal credit

Personal credit is separate from corporate credit.

`personal_credit_profiles` stores the customer account and limit/balance. `personal_credit_ledger` stores charges and payments. A credit charge may reference the order, allowing the manager to see exactly what the customer consumed, when, at which branch, and for what amount.

Creation and credit-management actions are restricted to manager/restaurant-admin roles. Cashiers and waiters do not create or alter credit profiles.

## Dashboard KPIs

The server provides branch-scoped daily KPIs for authorized dashboards:

- meals sold
- kitchen orders sent
- kitchen orders ready
- cashier amount received
- total sales amount
- paid/unpaid orders
- personal-credit sales
- corporate-credit sales

All metrics are computed server-side from tenant/branch-scoped data.

## Threat controls

- credential theft: cryptographic possession proof where supported
- copied local storage: must not be sufficient to impersonate device
- PIN brute force: Argon2id + lockout + audit
- IDOR: authenticated tenant/branch context is authoritative
- device theft: revoke device and terminate sessions
- device transfer: revoke old credential and enroll a new credential
- suspicious network changes: risk signal, not primary identity
- replay: one-time enrollment and idempotent business writes

## Recovery

Lost or replaced hardware is handled by revoking the old device, terminating its sessions, preserving its history, and enrolling the replacement through the normal administrator-controlled workflow.
