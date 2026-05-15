# Slack and Telegram Integrations

HyperOptimal Metrics must support web, Slack, and Telegram workflows from the start. Messaging integrations are tenant-scoped and must follow the same auth, RLS, and billing expectations as the web app.

## Environment Variables

- `SLACK_BOT_TOKEN`: server-only Slack bot token.
- `SLACK_SIGNING_SECRET`: server-only Slack request signing secret.
- `SLACK_APP_TOKEN`: server-only Slack app-level token for socket mode if needed later.
- `TELEGRAM_BOT_TOKEN`: server-only Telegram bot token.
- `TELEGRAM_WEBHOOK_SECRET`: server-only webhook secret token sent by Telegram.
- `ANTHROPIC_API_KEY`: server-only Anthropic key for Claude-backed responses if a messaging workflow needs AI.
- `ANTHROPIC_MODEL`: server-only Claude model identifier for AI messaging workflows.

## Data Model

- `tenant_integrations`: one row per tenant/provider connection.
- `integration_events`: verified inbound webhook/event payloads mapped to a tenant.
- `integration_messages`: tenant-scoped message records for read/write/save workflows.

## Rules

- Verify Slack signatures before reading or storing events.
- Verify Telegram webhook secret headers before reading or storing events.
- Map external workspace/chat/team identifiers to `tenant_integrations`.
- Do not persist events that cannot be mapped to a tenant.
- Store raw payloads only server-side and keep all tables protected by RLS.
- Use service-role writes only in trusted webhook handlers.
- If a Slack or Telegram workflow needs AI, use Claude through Anthropic. Do not introduce OpenAI keys, SDKs, or GPT model names.
