# KROWN Go-Live Checklist

## Release status
- [ ] Production Gate P0 green.
- [ ] Clean production build green.
- [ ] Runtime smoke tests green.
- [ ] No open critical/high security defects.
- [ ] Database integrity checks green.
- [ ] Backup/recovery verified.
- [ ] Monitoring and alerts active.
- [ ] Rollback procedure verified.

## Restaurant activation
- [ ] Organization created.
- [ ] Primary admin created and tested.
- [ ] Subscription assigned.
- [ ] Branches created and limits verified.
- [ ] Staff created and tested.
- [ ] Products/categories/prices configured.
- [ ] Taxes/payment methods configured.
- [ ] Printers tested.
- [ ] Test sale completed end-to-end.
- [ ] Inventory and accounting reconciled.
- [ ] Multi-branch isolation test completed.

## First-day monitoring
Watch authentication failures, API 5xx responses, failed sync operations, duplicate/idempotency conflicts, payment/order anomalies, printer failures, database latency/errors and support tickets.

## Non-negotiable
Never mark a restaurant active solely because the dashboard loads. The server-side authorization, financial transaction path, offline retry behavior and recovery path must also pass.
