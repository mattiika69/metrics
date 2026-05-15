# MVP Safety Infrastructure

HyperOptimal Metrics uses Supabase Postgres for MVP audit logs, webhook idempotency, and rate limiting.

## Audit Logs

`audit_events` stores tenant-scoped and user-scoped security/product activity. Tenant members can read tenant events. Users can read their own pre-tenant events. Writes happen through trusted server-side helpers.

## Webhook Idempotency

`webhook_events` stores provider events by `(provider, external_event_id)` so Stripe, Slack, and Telegram webhooks can be safely retried without double-processing.

## Rate Limiting

`rate_limit_buckets` stores fixed-window counters through the `increment_rate_limit` RPC. No public RLS policies are exposed for direct client access.

## CI

GitHub Actions runs `npm ci` and `npm run build` on pushes and pull requests for `main`.
