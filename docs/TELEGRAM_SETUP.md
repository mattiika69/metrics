# Telegram Agent Setup

HyperOptimal Metrics uses one tenant-scoped Telegram bot for this app. Telegram is only an interface; Supabase remains the source of truth for connection state, messages, actions, audit logs, and saved learnings.

## Setup

These are deployer steps only. App users should not paste Telegram tokens, chat IDs, or webhook details into HyperOptimal Metrics.

1. Create a bot with `@BotFather`.
2. Copy the bot token into Vercel as `TELEGRAM_BOT_TOKEN`.
3. Generate a secret token and add it to Vercel as `TELEGRAM_WEBHOOK_SECRET`.
4. Set the Telegram webhook to:

   ```text
   https://app.scalingmetrics.com/api/integrations/telegram/webhook
   ```

   Include the `secret_token` parameter with the same value as `TELEGRAM_WEBHOOK_SECRET`.

## User Connection Flow

1. The user signs in to HyperOptimal Metrics.
2. The user opens Settings > Telegram.
3. The user generates a link code.
4. The user sends `/link CODE` to the bot from the private group or chat they want to connect.
5. The app verifies the code server-side, links that chat to the user's workspace, and marks the code as used.
6. Settings > Telegram should show the chat as connected.

Link codes are stored hashed, expire quickly, and can be used once. Chat IDs are learned from Telegram webhook updates after the signed-in user generates a code.

## Required Environment Variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `APP_URL` or `NEXT_PUBLIC_APP_URL`
- `ANTHROPIC_API_KEY` for Claude-backed conversational responses
- `CLAUDE_MODEL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not prefix bot tokens, webhook secrets, Anthropic keys, or service-role keys with `NEXT_PUBLIC_`.

## Verification

In the configured private chat, test:

```text
/help
/status
What changed today?
Show me this week's metrics.
What is our biggest constraint?
Remember that our ICP is gym owners.
```

The bot should refuse unlinked chats, record mapped inbound and outbound messages in Supabase, save explicit learnings to AI Agent memory, and require confirmation for destructive or high-risk changes.

## Slack Parity

Slack and Telegram share the same conversational agent layer. New read/write tools should be added to the shared agent layer first, then exposed through provider adapters. Provider-specific handlers should only verify requests, map the channel/chat to a tenant, persist messages, and send responses.
