import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySlackSignature } from "@/lib/integrations/slack";

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    return Response.json({ error: "Missing SLACK_SIGNING_SECRET." }, { status: 500 });
  }

  const body = await request.text();
  const headerStore = await headers();
  const isVerified = verifySlackSignature({
    body,
    signature: headerStore.get("x-slack-signature"),
    timestamp: headerStore.get("x-slack-request-timestamp"),
    signingSecret,
  });

  if (!isVerified) {
    return Response.json({ error: "Invalid Slack signature." }, { status: 401 });
  }

  const payload = JSON.parse(body);

  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  const teamId = payload.team_id ?? payload.authorizations?.[0]?.team_id;

  if (!teamId) {
    return Response.json({ received: true, mapped: false });
  }

  const supabase = createAdminClient();
  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("id, tenant_id")
    .eq("provider", "slack")
    .eq("external_team_id", teamId)
    .maybeSingle();

  if (!integration) {
    return Response.json({ received: true, mapped: false });
  }

  await supabase.from("integration_events").insert({
    tenant_id: integration.tenant_id,
    integration_id: integration.id,
    provider: "slack",
    external_event_id: payload.event_id,
    event_type: payload.event?.type ?? payload.type ?? "unknown",
    payload,
  });

  return Response.json({ received: true, mapped: true });
}
