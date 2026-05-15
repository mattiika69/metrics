import { requireApiTenant } from "@/lib/auth/api";
import { createTelegramLinkCode } from "@/lib/integrations/telegram";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function canManage(role: string | undefined) {
  return role === "owner" || role === "admin";
}

export async function POST() {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;
  if (!canManage(context.membership.role)) {
    return Response.json({ error: "Only tenant admins can create Telegram link codes." }, { status: 403 });
  }

  const admin = createAdminClient();
  let code = createTelegramLinkCode();
  let expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  let insert = await admin.from("telegram_link_codes").insert({
    tenant_id: context.tenant.id,
    created_by: context.user.id,
    code,
    expires_at: expiresAt,
  });

  if (insert.error?.code === "23505") {
    code = createTelegramLinkCode();
    expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    insert = await admin.from("telegram_link_codes").insert({
      tenant_id: context.tenant.id,
      created_by: context.user.id,
      code,
      expires_at: expiresAt,
    });
  }

  if (insert.error) return Response.json({ error: insert.error.message }, { status: 500 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "telegram_link_code_created",
    targetType: "telegram",
    metadata: { expiresAt },
  });

  return Response.json({ code, expiresAt });
}
