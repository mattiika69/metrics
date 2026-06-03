import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentPlatform = "web" | "slack" | "telegram";
export type AgentRole = "owner" | "admin" | "member";

export type PlatformActor = {
  ok: true;
  tenantId: string;
  platform: AgentPlatform;
  userId: string;
  role: AgentRole;
  platformAccountId: string | null;
  externalUserId: string | null;
  displayName: string | null;
} | {
  ok: false;
  reason: string;
  linkPrompt: string;
};

export function isAdminRole(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

function linkPrompt(platform: AgentPlatform) {
  if (platform === "slack") {
    return "Please connect this workspace before I can read or change workspace data.";
  }
  if (platform === "telegram") {
    return "Please connect this workspace before I can read or change workspace data.";
  }
  return "Please sign in to HyperOptimal Metrics before I can read or change workspace data.";
}

export async function resolvePlatformActor({
  admin,
  tenantId,
  platform,
  externalWorkspaceId,
  externalUserId,
  webUserId,
}: {
  admin: SupabaseClient;
  tenantId: string;
  platform: AgentPlatform;
  externalWorkspaceId?: string | null;
  externalUserId?: string | null;
  webUserId?: string | null;
}): Promise<PlatformActor> {
  if (platform === "web") {
    if (!webUserId) {
      return { ok: false, reason: "web_user_missing", linkPrompt: linkPrompt(platform) };
    }
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", webUserId)
      .maybeSingle();

    if (!membership?.role) {
      return { ok: false, reason: "web_membership_missing", linkPrompt: linkPrompt(platform) };
    }

    return {
      ok: true,
      tenantId,
      platform,
      userId: webUserId,
      role: membership.role as AgentRole,
      platformAccountId: null,
      externalUserId: webUserId,
      displayName: null,
    };
  }

  if (!externalUserId) {
    return { ok: false, reason: "platform_user_missing", linkPrompt: linkPrompt(platform) };
  }

  let query = admin
    .from("platform_accounts")
    .select("id, user_id, display_name, status")
    .eq("tenant_id", tenantId)
    .eq("platform", platform)
    .eq("external_user_id", externalUserId)
    .eq("status", "active");

  if (externalWorkspaceId) {
    query = query.eq("external_workspace_id", externalWorkspaceId);
  }

  const { data: account } = await query.maybeSingle();
  if (!account?.user_id) {
    return { ok: false, reason: "platform_account_unlinked", linkPrompt: linkPrompt(platform) };
  }

  const { data: membership } = await admin
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", account.user_id)
    .maybeSingle();

  if (!membership?.role) {
    return { ok: false, reason: "platform_membership_missing", linkPrompt: linkPrompt(platform) };
  }

  return {
    ok: true,
    tenantId,
    platform,
    userId: account.user_id,
    role: membership.role as AgentRole,
    platformAccountId: account.id,
    externalUserId,
    displayName: account.display_name ?? null,
  };
}

export async function upsertPlatformInstallation({
  admin,
  tenantId,
  platform,
  tenantIntegrationId,
  externalWorkspaceId,
  externalWorkspaceName,
  externalBotUserId,
  installedByUserId,
  scopes,
  settings,
}: {
  admin: SupabaseClient;
  tenantId: string;
  platform: AgentPlatform;
  tenantIntegrationId?: string | null;
  externalWorkspaceId?: string | null;
  externalWorkspaceName?: string | null;
  externalBotUserId?: string | null;
  installedByUserId?: string | null;
  scopes?: string[];
  settings?: Record<string, unknown>;
}) {
  const { data: existing } = await admin
    .from("platform_installations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("platform", platform)
    .eq("external_workspace_id", externalWorkspaceId ?? "web")
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    platform,
    tenant_integration_id: tenantIntegrationId ?? null,
    external_workspace_id: externalWorkspaceId ?? "web",
    external_workspace_name: externalWorkspaceName ?? null,
    external_bot_user_id: externalBotUserId ?? null,
    installed_by_user_id: installedByUserId ?? null,
    scopes: scopes ?? [],
    status: "active",
    settings: settings ?? {},
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await admin.from("platform_installations").update(payload).eq("id", existing.id).select("id").single()
    : await admin.from("platform_installations").insert(payload).select("id").single();

  if (result.error) throw new Error(result.error.message);
  return result.data.id as string;
}

export async function upsertPlatformAccount({
  admin,
  tenantId,
  platform,
  platformInstallationId,
  externalWorkspaceId,
  externalUserId,
  userId,
  displayName,
  settings,
}: {
  admin: SupabaseClient;
  tenantId: string;
  platform: AgentPlatform;
  platformInstallationId?: string | null;
  externalWorkspaceId?: string | null;
  externalUserId: string;
  userId?: string | null;
  displayName?: string | null;
  settings?: Record<string, unknown>;
}) {
  const workspaceId = externalWorkspaceId ?? "web";
  const { data: existing } = await admin
    .from("platform_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("platform", platform)
    .eq("external_workspace_id", workspaceId)
    .eq("external_user_id", externalUserId)
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    platform,
    platform_installation_id: platformInstallationId ?? null,
    external_workspace_id: workspaceId,
    external_user_id: externalUserId,
    user_id: userId ?? null,
    display_name: displayName ?? null,
    status: "active",
    settings: settings ?? {},
    linked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await admin.from("platform_accounts").update(payload).eq("id", existing.id).select("id").single()
    : await admin.from("platform_accounts").insert(payload).select("id").single();

  if (result.error) throw new Error(result.error.message);
  return result.data.id as string;
}

export async function upsertPlatformConversation({
  admin,
  tenantId,
  platform,
  externalConversationId,
  externalThreadId,
  conversationType,
  title,
  linkedByUserId,
}: {
  admin: SupabaseClient;
  tenantId: string;
  platform: AgentPlatform;
  externalConversationId: string;
  externalThreadId?: string | null;
  conversationType?: string;
  title?: string | null;
  linkedByUserId?: string | null;
}) {
  const { data: existing } = await admin
    .from("platform_conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("platform", platform)
    .eq("external_conversation_id", externalConversationId)
    .eq("external_thread_id", externalThreadId ?? "")
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    platform,
    external_conversation_id: externalConversationId,
    external_thread_id: externalThreadId ?? "",
    conversation_type: conversationType ?? "channel",
    title: title ?? null,
    linked_by_user_id: linkedByUserId ?? null,
    status: "active",
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await admin.from("platform_conversations").update(payload).eq("id", existing.id).select("id").single()
    : await admin.from("platform_conversations").insert(payload).select("id").single();

  if (result.error) throw new Error(result.error.message);
  return result.data.id as string;
}
