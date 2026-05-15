import { headers } from "next/headers";
import { verifySlackSignature } from "@/lib/integrations/slack";
import { buildConstraintsCommandResponse, buildMetricsCommandResponse } from "@/lib/metrics/channel";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parseCommand(text: string | null) {
  const value = (text ?? "").trim().toLowerCase();
  if (value.includes("constraints")) return "constraints";
  return "metrics";
}

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return Response.json({ error: "Missing SLACK_SIGNING_SECRET." }, { status: 500 });

  const body = await request.text();
  const headerStore = await headers();
  const verified = verifySlackSignature({
    body,
    signature: headerStore.get("x-slack-signature"),
    timestamp: headerStore.get("x-slack-request-timestamp"),
    signingSecret,
  });
  if (!verified) return Response.json({ error: "Invalid Slack signature." }, { status: 401 });

  const params = new URLSearchParams(body);
  const teamId = params.get("team_id");
  const channelId = params.get("channel_id");
  const userId = params.get("user_id");
  const command = parseCommand(`${params.get("command") ?? ""} ${params.get("text") ?? ""}`);

  if (!teamId) return Response.json({ response_type: "ephemeral", text: "Slack team could not be resolved." });

  const admin = createAdminClient();
  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("id, tenant_id")
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .neq("status", "disabled")
    .maybeSingle();

  if (!integration) {
    return Response.json({
      response_type: "ephemeral",
      text: "Slack is not connected to a HyperOptimal Metrics workspace yet.",
    });
  }

  await admin.from("integration_messages").insert({
    tenant_id: integration.tenant_id,
    integration_id: integration.id,
    provider: "slack",
    direction: "inbound",
    external_channel_id: channelId,
    external_user_id: userId,
    body,
    payload: Object.fromEntries(params.entries()),
  });

  const text = command === "constraints"
    ? await buildConstraintsCommandResponse(integration.tenant_id)
    : await buildMetricsCommandResponse(integration.tenant_id);

  await admin.from("integration_messages").insert({
    tenant_id: integration.tenant_id,
    integration_id: integration.id,
    provider: "slack",
    direction: "outbound",
    external_channel_id: channelId,
    body: text,
    payload: { command },
  });

  await logAuditEvent({
    tenantId: integration.tenant_id,
    eventType: command === "constraints" ? "slack_constraints" : "slack_metrics",
    targetType: "slack",
    metadata: { teamId, channelId, userId },
  });

  return Response.json({ response_type: "ephemeral", text });
}
