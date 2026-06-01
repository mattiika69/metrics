# Environment Setup

Verified on 2026-06-01 against the Vercel project `mattiika69/metrics`.

## Required Variables

Public browser-safe variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASIC`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_BUSINESS`
- `SLACK_APP_ID`
- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Compatibility aliases currently supported:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `STRIPE_ONBOARDING_PRICE_ID`
- `STRIPE_PRICE_ID`
- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`

## Vercel Production Status

Configured in Vercel Production:

- Supabase URL, anon/publishable key, and service-role key.
- Stripe secret key, publishable key, webhook secret, and `$97/mo` Basic price.
- Slack app ID, OAuth client ID, OAuth client secret, and signing secret.
- Resend API key, `EMAIL_FROM`, and legacy Resend sender aliases.

Still manual:

- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_BUSINESS`

Do not prefix server-only variables with `NEXT_PUBLIC_`.

## Provider Notes

- Stripe Checkout Sessions are created server-side for subscriptions.
- Stripe webhooks are the source of truth for provisioning and subscription state.
- Stripe webhook handling verifies signatures using the raw request body and records idempotency before mutating billing state.
- Stripe Customer Portal is used for billing management.
- Supabase service-role access is limited to trusted server-side webhook/admin code.
- Slack OAuth starts server-side, Slack callbacks verify the expected app ID when Slack returns one, and Slack events, slash commands, and interactions verify signed raw request bodies before processing.
- Slack tenant bot tokens are captured through OAuth and stored server-side per tenant; `SLACK_BOT_TOKEN` is only a legacy/manual fallback.
- Product email sends are logged in Supabase with idempotency keys before provider delivery.
- Resend sender domains must be verified before production sends.
