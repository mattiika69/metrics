import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("env example lists required provider variables without fake secrets", () => {
  const envExample = read(".env.example");
  const required = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_BASIC",
    "STRIPE_PRICE_PRO",
    "STRIPE_PRICE_BUSINESS",
    "SLACK_APP_ID",
    "SLACK_CLIENT_ID",
    "SLACK_CLIENT_SECRET",
    "SLACK_SIGNING_SECRET",
    "SLACK_BOT_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_BOT_USERNAME",
    "TELEGRAM_WEBHOOK_SECRET",
    "AI_MODEL",
    "VERCEL_OIDC_TOKEN",
    "RESEND_API_KEY",
    "EMAIL_FROM",
  ];

  for (const name of required) {
    assert.match(envExample, new RegExp(`^${name}=`, "m"), `${name} is missing from .env.example`);
  }

  for (const serverOnly of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "SLACK_CLIENT_SECRET",
    "SLACK_SIGNING_SECRET",
    "SLACK_BOT_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "RESEND_API_KEY",
  ]) {
    assert.doesNotMatch(envExample, new RegExp(`^NEXT_PUBLIC_${serverOnly}=`, "m"));
  }

  const values = envExample
    .split(/\r?\n/)
    .map((line) => line.slice(line.indexOf("=") + 1).trim())
    .filter(Boolean);
  assert.deepEqual(
    values.filter((value) => /sk_live_|whsec_|service_role/i.test(value)),
    [],
  );
});

test("runtime env validation names missing variables without logging values", () => {
  const publicEnv = read("lib/env/public.ts");
  const serverEnv = read("lib/env/server.ts");

  assert.match(publicEnv, /class EnvConfigurationError/);
  assert.match(publicEnv, /Missing required environment variable/);
  assert.match(publicEnv, /NEXT_PUBLIC_APP_URL/);
  assert.match(serverEnv, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(serverEnv, /STRIPE_SECRET_KEY/);
  assert.match(serverEnv, /STRIPE_WEBHOOK_SECRET/);
  assert.match(serverEnv, /SLACK_APP_ID/);
  assert.match(serverEnv, /SLACK_CLIENT_ID/);
  assert.match(serverEnv, /SLACK_CLIENT_SECRET/);
  assert.match(serverEnv, /SLACK_SIGNING_SECRET/);
  assert.match(serverEnv, /TELEGRAM_BOT_TOKEN/);
  assert.match(serverEnv, /TELEGRAM_WEBHOOK_SECRET/);
  assert.match(serverEnv, /AI_MODEL/);
  assert.match(serverEnv, /RESEND_API_KEY/);
  assert.doesNotMatch(`${publicEnv}\n${serverEnv}`, /console\.(log|error|warn)/);
});

test("Slack OAuth and webhook handlers validate server-only environment", () => {
  const oauth = read("lib/integrations/slack-oauth.ts");
  const callback = read("app/api/integrations/slack/oauth/callback/route.ts");
  const events = read("app/api/integrations/slack/events/route.ts");
  const commands = read("app/api/integrations/slack/commands/route.ts");
  const interactions = read("app/api/integrations/slack/interactions/route.ts");

  assert.match(oauth, /getRequiredServerEnv\("SLACK_CLIENT_ID"\)/);
  assert.match(oauth, /getRequiredServerEnv\("SLACK_CLIENT_SECRET"\)/);
  assert.match(callback, /getOptionalServerEnv\("SLACK_APP_ID"\)/);
  assert.match(callback, /slack_app_mismatch/);
  for (const route of [events, commands, interactions]) {
    assert.match(route, /getRequiredServerEnv\("SLACK_SIGNING_SECRET"\)/);
    assert.match(route, /verifySlackSignature/);
    assert.match(route, /await request\.text\(\)/);
  }
  assert.match(events, /payload\.type === "url_verification"/);
  assert.match(events, /new Response\(payload\.challenge/);
  assert.match(events, /text\/plain; charset=utf-8/);
  assert.ok(
    events.indexOf("url_verification") < events.indexOf("const rateLimit = await checkRateLimit"),
    "Slack URL verification must return before rate limit/database work",
  );
});

test("checkout uses server-created subscription sessions with tenant metadata", () => {
  const actions = read("lib/auth/actions.ts");

  assert.match(actions, /stripe\.checkout\.sessions\.create/);
  assert.match(actions, /mode:\s*"subscription"/);
  assert.match(actions, /price:\s*onboardingPriceId/);
  assert.match(actions, /client_reference_id:\s*tenant\.id/);
  assert.match(actions, /subscription_data:\s*{/);
  assert.match(actions, /tenant_id:\s*tenant\.id/);
  assert.match(actions, /success_url:\s*`\$\{origin\}\/get-started\?billing=success/);
  assert.match(actions, /cancel_url:\s*`\$\{origin\}\/get-started\?billing=cancelled/);
});

test("billing prices prefer STRIPE_PRICE_BASIC and keep legacy compatibility", () => {
  const prices = read("lib/billing/prices.ts");
  const plans = read("app/api/billing/plans/route.ts");

  assert.match(prices, /STRIPE_PRICE_BASIC/);
  assert.match(prices, /STRIPE_ONBOARDING_PRICE_ID/);
  assert.match(prices, /STRIPE_PRICE_ID/);
  assert.match(plans, /stripePriceIds/);
  assert.match(plans, /stripePriceId:\s*stripePriceIds\.basic/);
});

test("webhooks verify raw Stripe signatures and record idempotency before mutation", () => {
  const webhook = read("app/api/stripe/webhook/route.ts");

  assert.match(webhook, /stripe\.webhooks\.constructEvent/);
  assert.match(webhook, /await request\.text\(\)/);
  assert.match(webhook, /STRIPE_WEBHOOK_SECRET/);
  assert.match(webhook, /recordWebhookEvent/);
  assert.match(webhook, /webhook\.duplicate/);
  assert.match(webhook, /markWebhookProcessed/);
});

test("billing portal and seat quantity sync stay server-side", () => {
  const portal = read("app/api/billing/portal/route.ts");
  const webhook = read("app/api/stripe/webhook/route.ts");

  assert.match(portal, /stripe\.billingPortal\.sessions\.create/);
  assert.match(portal, /requireAdminContext/);
  assert.match(webhook, /billing_subscription_items/);
  assert.match(webhook, /quantity:\s*item\.quantity \?\? 1/);
});

test("email sends are logged with idempotency keys before provider delivery", () => {
  const send = read("lib/email/send.ts");
  const route = read("app/api/email/send/route.ts");
  const migration = read("supabase/migrations/20260601223000_add_email_idempotency_keys.sql");

  assert.match(route, /idempotency-key/i);
  assert.match(send, /idempotency_key:\s*idempotencyKey/);
  assert.match(send, /insert\(\{/);
  assert.match(send, /createResendClient\(\)/);
  assert.match(send, /23505/);
  assert.match(migration, /email_messages_tenant_idempotency_key_idx/);
  assert.match(migration, /email_messages_system_idempotency_key_idx/);
});
