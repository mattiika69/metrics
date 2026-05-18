"use server";

import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWith(path: string, key: "error" | "message", value: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${key}=${encodeURIComponent(value)}`);
}

function normalizeTelegramUsername(value: string) {
  return value.replace(/^@+/, "").trim();
}

function isValidTelegramUsername(value: string) {
  return value === "" || /^[A-Za-z0-9_]{5,32}$/.test(value);
}

function objectSettings(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function saveTelegramUsernameAction(formData: FormData) {
  const { tenant, user, membership } = await requireTenant();

  if (membership.role !== "owner" && membership.role !== "admin") {
    redirectWith("/settings/telegram", "error", "Only admins can update Telegram settings.");
  }

  const username = normalizeTelegramUsername(formText(formData, "telegramUsername"));
  if (!isValidTelegramUsername(username)) {
    redirectWith(
      "/settings/telegram",
      "error",
      "Enter a valid Telegram username.",
    );
  }

  const admin = createAdminClient();
  const { data: existingRows } = await admin
    .from("tenant_integrations")
    .select("id, settings, status")
    .eq("tenant_id", tenant.id)
    .eq("provider", "telegram")
    .order("updated_at", { ascending: false })
    .limit(1);
  const existing = existingRows?.[0] ?? null;
  const settings = {
    ...objectSettings(existing?.settings),
    telegramUsername: username || null,
  };

  if (existing) {
    const { error } = await admin
      .from("tenant_integrations")
      .update({
        settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("tenant_id", tenant.id);
    if (error) redirectWith("/settings/telegram", "error", error.message);
  } else {
    const { error } = await admin
      .from("tenant_integrations")
      .insert({
        tenant_id: tenant.id,
        provider: "telegram",
        status: "disabled",
        display_name: username ? `@${username}` : "Telegram",
        settings,
      });
    if (error) redirectWith("/settings/telegram", "error", error.message);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "telegram_username_saved",
    targetType: "tenant_integration",
    targetId: "telegram",
    metadata: { hasUsername: Boolean(username) },
  });

  redirectWith("/settings/telegram", "message", "Telegram username saved.");
}
