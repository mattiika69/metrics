# Slack and Telegram Integrations

HyperOptimal Metrics must support web, Slack, and Telegram workflows from the start. Messaging integrations are tenant-scoped and must follow the same auth, RLS, and billing expectations as the web app.

## Environment Variables

- `SLACK_CLIENT_ID`: server-only Slack OAuth client ID.
- `SLACK_CLIENT_SECRET`: server-only Slack OAuth client secret.
- `SLACK_SIGNING_SECRET`: server-only Slack request signing secret.
- `SLACK_APP_ID`: server-only Slack app ID used to validate OAuth callbacks when Slack returns the app ID.
- `SLACK_APP_TOKEN`: server-only Slack app-level token for socket mode if needed later.
- `TELEGRAM_BOT_TOKEN`: server-only Telegram bot token.
- `TELEGRAM_WEBHOOK_SECRET`: server-only webhook secret token sent by Telegram.
- `ANTHROPIC_API_KEY`: server-only Anthropic key for Claude-backed responses if a messaging workflow needs AI.
- `CLAUDE_MODEL`: server-only Claude model identifier for AI messaging workflows.
- `INTEGRATION_SECRET_KEY`: server-only encryption key for stored provider secrets.
- `SCHEDULE_WORKER_SECRET`: server-only secret for scheduled workflow execution.

## Data Model

- `tenant_integrations`: one row per tenant/provider connection.
- `integration_events`: verified inbound webhook/event payloads mapped to a tenant.
- `integration_messages`: tenant-scoped message records for read/write/save workflows.
- `slack_installations`, `slack_links`, `telegram_links`: provider-specific tenant links.
- `integration_inbound_events`, `integration_outbound_messages`, `integration_processed_events`: canonical event and message records.
- `agent_requests`, `agent_actions`: shared Slack/Telegram request and action records.
- `integration_workflow_schedules`, `integration_workflow_runs`, `integration_workflow_run_events`: scheduled Slack/Telegram workflow records.

## Connection Flows

Slack is connected from the web app. A signed-in owner/admin opens Settings > Slack, clicks Connect Slack, completes Slack OAuth, and the callback maps the Slack workspace to the current tenant. To use a private channel, invite the bot to that channel, then mention it or run `/agent` once. The first approved Slack channel is stored in `tenant_integrations`, and every linked channel is recorded in `integration_channel_links`.

Telegram is connected from the web app. A signed-in owner/admin opens Settings > Telegram, generates a one-time code, adds the bot to the target group or opens the private chat, and sends `/link CODE` in that chat. The webhook verifies the code server-side, maps that chat to the current tenant, and records it in `integration_channel_links`.

Users should never paste provider tokens, Slack team IDs, Slack channel IDs, Telegram chat IDs, or bot setup details into the product UI.

## Shared Agent Layer

Slack and Telegram must use the same conversational agent and tool layer. Provider adapters are responsible only for:

- verifying provider signatures or webhook secrets;
- resolving the tenant from the Slack team/channel or Telegram chat;
- persisting inbound and outbound messages;
- passing normalized text into the shared agent layer;
- delivering the response back to the provider.

New agent capabilities must be added to the shared agent layer first. Do not duplicate business logic in Slack-only or Telegram-only handlers.

Current shared capabilities:

- `/help` and `/status`;
- metric, constraint, forecast, input, marketing, sales, retention, and finance reads;
- natural language questions routed through Claude when configured;
- high-risk or destructive requests saved for confirmation instead of being executed.

## Rules

- Verify Slack signatures before reading or storing events.
- Verify Telegram webhook secret headers before reading or storing events.
- Map external workspace/chat/team identifiers to `tenant_integrations`.
- Do not persist private event data when an event cannot be mapped to a tenant.
- Store raw payloads only server-side and keep all tables protected by RLS.
- Use service-role writes only in trusted webhook handlers.
- If a Slack or Telegram workflow needs AI, use Claude through Anthropic. Do not introduce OpenAI keys, SDKs, or GPT model names.
- Load AI Context Document, Training records when present, and recent channel conversation before messaging workflows write.
- If a channel/chat is not mapped to a tenant, acknowledge safely and do not process private app data.
