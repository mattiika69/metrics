# AI Provider

HyperOptimal Metrics uses the Claude API through Anthropic for any AI-assisted workflow.

## Environment Variables

- `ANTHROPIC_API_KEY`: server-only Anthropic API key.
- `ANTHROPIC_MODEL`: server-only Claude model identifier selected for the deployed app.

## Rules

- Do not add OpenAI API keys, OpenAI SDKs, GPT model names, or OpenAI-specific environment variables.
- Keep Claude credentials server-only; never expose Anthropic keys to browser code.
- AI actions must resolve an authenticated user and tenant before reading or writing tenant data.
- AI actions from Slack or Telegram must use the same tenant mapping and RLS-backed persistence as web actions.
- Store AI-generated durable outputs in Supabase before returning success to the user.
- Log tenant-scoped AI actions to audit events when they read, write, send, or mutate tenant data.
