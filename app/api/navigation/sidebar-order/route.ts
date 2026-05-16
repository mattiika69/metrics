import { requireTenantContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

const allowedSidebarItemIds = [
  "metrics-most-important",
  "metrics-reverse-engineering",
  "metrics-financial",
  "metrics-churn-ltv",
  "metrics-sales",
  "metrics-inputs",
  "constraints",
  "settings",
];

function sanitizeOrder(input: unknown) {
  const ids = Array.isArray(input) ? input.filter((item) => typeof item === "string") : [];
  const allowed = new Set(allowedSidebarItemIds);
  const seen = new Set<string>();
  const ordered = ids.filter((itemId) => {
    if (!allowed.has(itemId) || seen.has(itemId)) return false;
    seen.add(itemId);
    return true;
  });

  for (const itemId of allowedSidebarItemIds) {
    if (!seen.has(itemId)) ordered.push(itemId);
  }

  return ordered;
}

export async function GET() {
  const result = await requireTenantContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { data } = await context.supabase
    .from("tenant_sidebar_preferences")
    .select("item_ids")
    .eq("tenant_id", context.tenant.id)
    .eq("user_id", context.user.id)
    .maybeSingle();

  return Response.json({
    itemIds: sanitizeOrder(data?.item_ids),
  });
}

export async function POST(request: Request) {
  const result = await requireTenantContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const payload = await request.json().catch(() => ({}));
  const itemIds = sanitizeOrder(payload.itemIds);
  const { error } = await context.supabase.from("tenant_sidebar_preferences").upsert(
    {
      tenant_id: context.tenant.id,
      user_id: context.user.id,
      item_ids: itemIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,user_id" },
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "sidebar_order_saved",
    targetType: "tenant_sidebar_preferences",
    targetId: context.user.id,
    metadata: { itemIds },
  });

  return Response.json({ itemIds });
}
