import { headers } from "next/headers";
import { verifySlackSignature } from "@/lib/integrations/slack";
import { logAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

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
  const payload = params.get("payload");
  await logAuditEvent({
    eventType: "slack_interaction_received",
    targetType: "slack",
    metadata: { hasPayload: Boolean(payload) },
  });

  return Response.json({ ok: true });
}
