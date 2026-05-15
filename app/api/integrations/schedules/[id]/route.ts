import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (
      [
        "name",
        "workflow_key",
        "target_providers",
        "slack_channel_id",
        "telegram_chat_id",
        "cadence",
        "cron_expression",
        "timezone",
        "message_template",
        "enabled",
      ].includes(key)
    ) {
      allowed[key] = value;
    }
  }

  const { data, error } = await context.supabase
    .from("integration_workflow_schedules")
    .update({
      ...allowed,
      updated_by_user_id: context.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "workflow_schedule_updated",
    targetType: "integration_workflow_schedules",
    targetId: id,
  });

  return Response.json({ schedule: data });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { id } = await params;
  const { error } = await context.supabase
    .from("integration_workflow_schedules")
    .update({
      archived_at: new Date().toISOString(),
      updated_by_user_id: context.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "workflow_schedule_archived",
    targetType: "integration_workflow_schedules",
    targetId: id,
  });

  return Response.json({ ok: true });
}
