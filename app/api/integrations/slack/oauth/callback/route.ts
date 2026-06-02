import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthBypassContext, isAuthBypassEnabled } from "@/lib/auth/bypass";
import { upsertPlatformAccount, upsertPlatformInstallation } from "@/lib/agent/platform";
import { getOptionalServerEnv } from "@/lib/env/server";
import {
  exchangeSlackOAuthCode,
  hashSlackOAuthState,
  slackOAuthStateCookie,
  slackOAuthTenantCookie,
} from "@/lib/integrations/slack-oauth";
import { storeMetricIntegrationSecret } from "@/lib/integrations/secret-store";
import { logAuditEvent } from "@/lib/security/audit";
import { encryptSecretJson } from "@/lib/security/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/urls/app";

export const dynamic = "force-dynamic";

function canManageSlackOAuth(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

async function authorizeSlackOAuthTenant(
  tenantId: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (canManageSlackOAuth(membership?.role)) {
      return { userId: user.id };
    }

    return null;
  }

  if (isAuthBypassEnabled()) {
    const context = await getAuthBypassContext();
    if (
      context.tenant.id === tenantId &&
      canManageSlackOAuth(context.membership.role)
    ) {
      return { userId: context.user.id };
    }
  }

  return null;
}

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

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: oauthState } = await admin
    .from("integration_oauth_states")
    .update({ consumed_at: now })
    .eq("tenant_id", tenantId)
    .eq("provider", "slack")
    .eq("state_hash", hashSlackOAuthState(state))
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("id, created_by")
    .maybeSingle();

  if (!oauthState) {
    redirect("/settings/slack?error=invalid_slack_oauth_state");
  }

  const authorized = await authorizeSlackOAuthTenant(tenantId, admin);
  if (!authorized) {
    redirect("/settings/slack?error=slack_oauth_access_denied");
  }
  if (oauthState.created_by && oauthState.created_by !== authorized.userId) {
    redirect("/settings/slack?error=slack_oauth_access_denied");
  }

  const origin = await getAppBaseUrl();
  let oauth: Awaited<ReturnType<typeof exchangeSlackOAuthCode>>;
  try {
    oauth = await exchangeSlackOAuthCode({ code, origin });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack OAuth exchange failed.";
    redirect(`/settings/slack?error=${encodeURIComponent(message)}`);
  }
  const expectedAppId = getOptionalServerEnv("SLACK_APP_ID");
  if (expectedAppId && oauth.app_id && oauth.app_id !== expectedAppId) {
    redirect("/settings/slack?error=slack_app_mismatch");
  }
  const teamId = oauth.team?.id?.trim();
  const botToken = oauth.access_token?.trim();

  if (!teamId || !botToken) {
    redirect("/settings/slack?error=missing_slack_oauth_payload");
  }

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

  await storeMetricIntegrationSecret({
    admin,
    tenantId,
    tenantIntegrationId: integration.id,
    provider: "slack",
    values: { botToken },
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
      created_by_user_id: authorized.userId,
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
      user_id: authorized.userId,
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
  const platformInstallationId = await upsertPlatformInstallation({
    admin,
    tenantId,
    platform: "slack",
    tenantIntegrationId: integration.id,
    externalWorkspaceId: teamId,
    externalWorkspaceName: oauth.team?.name ?? "Slack",
    externalBotUserId: oauth.bot_user_id ?? null,
    installedByUserId: authorized.userId,
    scopes: oauth.scope?.split(",").map((scope) => scope.trim()).filter(Boolean) ?? [],
    settings: {
      appId: oauth.app_id ?? null,
      botId: oauth.bot_id ?? null,
    },
  });
  if (oauth.authed_user?.id) {
    await upsertPlatformAccount({
      admin,
      tenantId,
      platform: "slack",
      platformInstallationId,
      externalWorkspaceId: teamId,
      externalUserId: oauth.authed_user.id,
      userId: authorized.userId,
      displayName: oauth.authed_user.id,
      settings: { linkedBy: "oauth" },
    });
  }

  await logAuditEvent({
    tenantId,
    actorUserId: authorized.userId,
    eventType: "slack_connected",
    targetType: "slack",
    targetId: teamId,
    metadata: { teamName: oauth.team?.name ?? null },
  });

  redirect("/settings/slack?connected=1");
}
