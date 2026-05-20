import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminContext } from "@/lib/api/context";
import {
  buildSlackAuthorizeUrl,
  createSlackOAuthState,
  hashSlackOAuthState,
  slackOAuthStateCookie,
  slackOAuthTenantCookie,
} from "@/lib/integrations/slack-oauth";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/urls/app";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;

  const state = createSlackOAuthState();
  const origin = await getAppBaseUrl();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { error } = await admin.from("integration_oauth_states").insert({
    tenant_id: context.tenant.id,
    provider: "slack",
    state_hash: hashSlackOAuthState(state),
    created_by: context.user.id,
    expires_at: expiresAt,
  });
  if (error) {
    redirect(`/settings/slack?error=${encodeURIComponent("Could not start Slack connection. Try again.")}`);
  }
  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "slack_oauth_started",
    targetType: "slack",
    metadata: { expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(slackOAuthStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  });
  cookieStore.set(slackOAuthTenantCookie, context.tenant.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  });

  redirect(buildSlackAuthorizeUrl({ origin, state }));
}
