"use server";

import { requireTenant } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/security/audit";

const allowedSidebarItemIds = [
  "metrics-most-important",
  "metrics-reverse-engineering",
  "metrics-financial",
  "metrics-churn-ltv",
  "metrics-sales",
  "metrics-cost-per-call",
  "metrics-inputs",
  "constraints",
  "settings-account",
  "settings-team",
  "settings-billing",
  "settings-integrations",
  "settings-scheduling",
  "settings-slack",
  "settings-telegram",
] as const;

function sanitizeOrder(itemIds: string[]) {
  const allowed = new Set<string>(allowedSidebarItemIds);
  const seen = new Set<string>();
  const ordered = itemIds.filter((itemId) => {
    if (!allowed.has(itemId) || seen.has(itemId)) return false;
    seen.add(itemId);
    return true;
  });

  for (const itemId of allowedSidebarItemIds) {
    if (!seen.has(itemId)) ordered.push(itemId);
  }

  return ordered;
}

export async function loadSidebarOrder(defaultItemIds: string[]) {
  try {
    const { supabase, tenant, user } = await requireTenant();
    const { data } = await supabase
      .from("tenant_sidebar_preferences")
      .select("item_ids")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle();

    return sanitizeOrder(Array.isArray(data?.item_ids) ? data.item_ids as string[] : defaultItemIds);
  } catch {
    return sanitizeOrder(defaultItemIds);
  }
}

export async function saveSidebarOrderAction(itemIds: string[]) {
  const { supabase, tenant, user } = await requireTenant();
  const sanitized = sanitizeOrder(itemIds);
  const { error } = await supabase
    .from("tenant_sidebar_preferences")
    .upsert({
      tenant_id: tenant.id,
      user_id: user.id,
      item_ids: sanitized,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "tenant_id,user_id",
    });

  if (error) throw new Error(error.message);

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "sidebar_order_saved",
    targetType: "tenant_sidebar_preferences",
    targetId: user.id,
    metadata: { itemIds: sanitized },
  });

  return { ok: true };
}
