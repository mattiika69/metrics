import { requireAdminContext, requireTenantContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireTenantContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { data, error } = await context.supabase
    .from("integration_workflow_schedules")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ schedules: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const payload = await request.json().catch(() => ({}));
  const targetProviders = Array.isArray(payload.targetProviders)
    ? payload.targetProviders.filter((item: unknown) => typeof item === "string")
    : [];

  if (!payload.name || typeof payload.name !== "string") {
    return Response.json({ error: "Schedule name is required." }, { status: 400 });
  }

  if (!targetProviders.length) {
    return Response.json({ error: "Choose at least one target." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("integration_workflow_schedules")
    .insert({
      tenant_id: context.tenant.id,
      name: payload.name,
      workflow_key: payload.workflowKey ?? "metrics_report",
      target_providers: targetProviders,
      slack_channel_id: payload.slackChannelId ?? null,
      telegram_chat_id: payload.telegramChatId ?? null,
      cadence: payload.cadence ?? "weekly",
      cron_expression: payload.cronExpression ?? null,
      timezone: payload.timezone ?? "America/New_York",
      message_template: payload.messageTemplate ?? null,
      created_by_user_id: context.user.id,
      updated_by_user_id: context.user.id,
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "workflow_schedule_created",
    targetType: "integration_workflow_schedules",
    targetId: data.id,
  });

  return Response.json({ schedule: data }, { status: 201 });
}
