import { headers } from "next/headers";
import { envErrorResponse, getRequiredServerEnv } from "@/lib/env/server";
import { verifySlackSignature } from "@/lib/integrations/slack";
import { getRequestIp } from "@/lib/request/ip";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let signingSecret: string;
  try {
    signingSecret = getRequiredServerEnv("SLACK_SIGNING_SECRET");
  } catch (error) {
    return envErrorResponse(error);
  }

  const rateLimit = await checkRateLimit({
    route: "webhook:slack:interactions",
    key: `slack:interactions:${await getRequestIp()}`,
    limit: 120,
    windowSeconds: 60,
    metadata: { provider: "slack" },
  });

  if (!rateLimit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

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
