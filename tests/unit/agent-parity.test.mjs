import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("web, Slack, and Telegram all use the shared unified agent runner", () => {
  const runner = read("lib/agent/runner.ts");
  const channel = read("lib/agent/channel.ts");
  const webActions = read("app/settings/agent/actions.ts");
  const slackEvents = read("app/api/integrations/slack/events/route.ts");
  const slackCommands = read("app/api/integrations/slack/commands/route.ts");
  const telegramWebhook = read("app/api/integrations/telegram/webhook/route.ts");

  assert.match(runner, /export async function runUnifiedAgent/);
  assert.match(runner, /resolvePlatformActor/);
  assert.match(runner, /createAgentTools/);
  assert.match(runner, /agent_messages/);
  assert.match(runner, /agent_approvals/);
  assert.match(runner, /getRequiredOneOfServerEnv\(\["ANTHROPIC_API_KEY", "VERCEL_OIDC_TOKEN"\]\)/);

  assert.match(channel, /runUnifiedAgent/);
  assert.doesNotMatch(channel, /runAgentReply/);
  assert.match(webActions, /runUnifiedAgent/);
  assert.match(slackEvents, /createChannelAgentRequest/);
  assert.match(slackCommands, /createChannelAgentRequest/);
  assert.match(telegramWebhook, /createChannelAgentRequest/);
});

test("agent tools enforce server-side permissions, approvals, and audit logging", () => {
  const tools = read("lib/agent/tools.ts");

  for (const name of [
    "search_app_data",
    "get_record",
    "create_record",
    "update_record",
    "delete_record",
    "invite_team_member",
    "remove_team_member",
    "get_billing_status",
    "create_billing_portal_session",
    "send_email",
    "summarize_activity",
    "request_approval",
    "confirm_approval",
  ]) {
    assert.match(tools, new RegExp(`${name}: tool`), `${name} tool is missing`);
  }

  assert.match(tools, /canWrite\(context\.role\)/);
  assert.match(tools, /recordCapability/);
  assert.match(tools, /logAuditEvent/);
  assert.match(tools, /action_type: "team_invite"/);
  assert.match(tools, /approvalRequired: true/);
  assert.match(tools, /escapeEmailHtml/);
  assert.doesNotMatch(tools, /from\("tenant_invitations"\)[\s\S]{0,260}\.insert/);
});

test("Slack and Telegram adapters verify provider requests and link platform accounts", () => {
  const slackEvents = read("app/api/integrations/slack/events/route.ts");
  const slackCommands = read("app/api/integrations/slack/commands/route.ts");
  const slackOAuth = read("app/api/integrations/slack/oauth/callback/route.ts");
  const slackOauthLib = read("lib/integrations/slack-oauth.ts");
  const telegramWebhook = read("app/api/integrations/telegram/webhook/route.ts");

  assert.match(slackEvents, /verifySlackSignature/);
  assert.match(slackEvents, /payload\.type === "url_verification"/);
  assert.match(slackCommands, /verifySlackSignature/);
  assert.match(slackOAuth, /upsertPlatformInstallation/);
  assert.match(slackOAuth, /upsertPlatformAccount/);

  for (const scope of [
    "chat:write",
    "app_mentions:read",
    "channels:read",
    "channels:history",
    "groups:read",
    "groups:history",
    "im:history",
    "mpim:history",
  ]) {
    assert.match(slackOauthLib, new RegExp(scope.replace(":", ":")), `Slack scope ${scope} missing`);
  }
  assert.doesNotMatch(slackOauthLib, /chat:write\.public/);

  assert.match(telegramWebhook, /timingSafeEqualString/);
  assert.match(telegramWebhook, /x-telegram-bot-api-secret-token/);
  assert.match(telegramWebhook, /recordWebhookEvent/);
  assert.match(telegramWebhook, /webhook\.duplicate/);
  assert.match(telegramWebhook, /upsertPlatformInstallation/);
  assert.match(telegramWebhook, /upsertPlatformAccount/);
});

test("agent persistence migration creates tenant-scoped RLS tables", () => {
  const migration = read("supabase/migrations/20260602001618_add_cross_platform_agent_foundation.sql");

  for (const table of [
    "platform_installations",
    "platform_accounts",
    "platform_conversations",
    "agent_messages",
    "agent_memories",
    "audit_logs",
    "capability_checks",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} table missing`);
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} RLS missing`);
    assert.match(migration, new RegExp(`${table}[\\s\\S]*tenant_id`), `${table} tenant_id missing`);
  }

  assert.match(migration, /alter table public\.agent_approvals/);
  assert.match(migration, /action_payload jsonb/);
  assert.match(migration, /public\.is_tenant_member\(tenant_id\)/);
  assert.match(migration, /public\.has_tenant_role/);
});

test("Settings exposes wired Slack private channel and Telegram group tabs", () => {
  const tabs = read("components/settings/settings-tabs.tsx");
  const slackPage = read("app/settings/slack/page.tsx");
  const telegramPage = read("app/settings/telegram/page.tsx");
  const channelLinks = read("lib/integrations/channel-links.ts");
  const slackEvents = read("app/api/integrations/slack/events/route.ts");
  const slackCommands = read("app/api/integrations/slack/commands/route.ts");
  const telegramWebhook = read("app/api/integrations/telegram/webhook/route.ts");

  assert.match(tabs, /id: "slack"/);
  assert.match(tabs, /href: "\/settings\/slack"/);
  assert.match(tabs, /id: "telegram"/);
  assert.match(tabs, /href: "\/settings\/telegram"/);

  assert.match(slackPage, /SettingsTabs active="slack"/);
  assert.match(slackPage, /Connect Slack/);
  assert.match(slackPage, /private channel/i);
  assert.match(slackPage, /integration_channel_links/);
  assert.match(slackEvents, /upsertIntegrationChannelLink/);
  assert.match(slackCommands, /upsertIntegrationChannelLink/);

  assert.match(telegramPage, /SettingsTabs active="telegram"/);
  assert.match(telegramPage, /Generate link code/);
  assert.match(telegramPage, /Add to group/);
  assert.match(telegramPage, /TELEGRAM_BOT_USERNAME/);
  assert.match(telegramPage, /integration_channel_links/);
  assert.match(telegramWebhook, /upsertIntegrationChannelLink/);

  assert.match(channelLinks, /integration_channel_links/);
  assert.match(channelLinks, /onConflict: "tenant_id,provider,external_channel_id"/);
});
