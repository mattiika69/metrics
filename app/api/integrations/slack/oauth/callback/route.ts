import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  exchangeSlackOAuthCode,
  slackOAuthStateCookie,
  slackOAuthTenantCookie,
} from "@/lib/integrations/slack-oauth";
import { logAuditEvent } from "@/lib/security/audit";
import { encryptSecretJson } from "@/lib/security/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(slackOAuthStateCookie)?.value;
  const tenantId = cookieStore.get(slackOAuthTenantCookie)?.value;

  cookieStore.delete(slackOAuthStateCookie);
  cookieStore.delete(slackOAuthTenantCookie);

  if (!code || !state || !expectedState || state !== expectedState || !tenantId) {
    redirect("/settings/slack?error=invalid_slack_oauth_state");
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const oauth = await exchangeSlackOAuthCode({ code, origin });
  const teamId = oauth.team?.id?.trim();
  const botToken = oauth.access_token?.trim();

  if (!teamId || !botToken) {
    redirect("/settings/slack?error=missing_slack_oauth_payload");
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("tenant_integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    provider: "slack",
    status: "active",
    external_team_id: teamId,
    external_bot_id: oauth.bot_id ?? null,
    external_user_id: oauth.authed_user?.id ?? null,
    display_name: oauth.team?.name ?? "Slack",
    settings: {
      botUserId: oauth.bot_user_id ?? null,
      appId: oauth.app_id ?? null,
      scope: oauth.scope ?? null,
    },
    updated_at: new Date().toISOString(),
  };

  const { data: integration, error } = existing
    ? await admin
      .from("tenant_integrations")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single()
    : await admin
      .from("tenant_integrations")
      .insert(payload)
      .select("id")
      .single();

  if (error) {
    redirect(`/settings/slack?error=${encodeURIComponent(error.message)}`);
  }

  await admin.from("metric_integration_secrets").insert({
    tenant_id: tenantId,
    tenant_integration_id: integration.id,
    provider: "slack",
    secret_values: { botToken },
  });
  await admin.from("slack_installations").upsert(
    {
      tenant_id: tenantId,
      tenant_integration_id: integration.id,
      slack_team_id: teamId,
      slack_team_name: oauth.team?.name ?? null,
      slack_bot_user_id: oauth.bot_user_id ?? null,
      slack_app_id: oauth.app_id ?? null,
      status: "active",
      settings: {
        scope: oauth.scope ?? null,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,slack_team_id" },
  );
  await admin.from("slack_links").upsert(
    {
      tenant_id: tenantId,
      slack_team_id: teamId,
      slack_user_id: oauth.authed_user?.id ?? null,
      slack_channel_id: null,
      status: "active",
      settings: {
        linkedBy: "oauth",
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,slack_team_id,slack_user_id,slack_channel_id" },
  );
  await admin.from("integration_secrets").upsert(
    {
      tenant_id: tenantId,
      provider: "slack",
      secret_name: "bot_token",
      secret_ciphertext: encryptSecretJson({ botToken }),
      key_version: "v1",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider,secret_name" },
  );

  await logAuditEvent({
    tenantId,
    eventType: "slack_connected",
    targetType: "slack",
    targetId: teamId,
    metadata: { teamName: oauth.team?.name ?? null },
  });

  redirect("/settings/slack?connected=1");
}
