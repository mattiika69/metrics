import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { data, error } = await context.supabase
    .from("agent_requests")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const payload = await request.json().catch(() => ({}));
  const requestText = typeof payload.requestText === "string" ? payload.requestText.trim() : "";

  if (!requestText) {
    return Response.json({ error: "Request text is required." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("agent_requests")
    .insert({
      tenant_id: context.tenant.id,
      requested_by_user_id: context.user.id,
      provider: payload.provider ?? "web",
      channel_id: payload.channelId ?? null,
      request_text: requestText,
      risk_level: payload.riskLevel ?? "normal",
      metadata: payload.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "agent_request_created",
    targetType: "agent_requests",
    targetId: data.id,
  });

  return Response.json({ request: data }, { status: 201 });
}
