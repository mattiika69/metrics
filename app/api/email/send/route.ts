import {
  isValidEmailAddress,
  normalizeEmailRecipients,
  sendTenantEmail,
} from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type SendEmailPayload = {
  tenantId?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
};

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as SendEmailPayload | null;
  if (!payload) {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const tenantId = payload.tenantId;
  const recipients = normalizeEmailRecipients(Array.isArray(payload.to)
    ? payload.to
    : payload.to
      ? [payload.to]
      : []);

  if (!tenantId || recipients.length === 0 || !payload.subject) {
    return Response.json(
      { error: "tenantId, to, and subject are required." },
      { status: 400 },
    );
  }

  const invalidRecipient = recipients.find((recipient) => !isValidEmailAddress(recipient));
  if (invalidRecipient) {
    return Response.json(
      { error: `Invalid recipient: ${invalidRecipient}` },
      { status: 400 },
    );
  }

  if (!payload.text && !payload.html) {
    return Response.json(
      { error: "Either text or html content is required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: isMember } = await supabase.rpc("is_tenant_member", {
    target_tenant_id: tenantId,
  });

  if (!isMember) {
    return Response.json({ error: "Tenant access denied." }, { status: 403 });
  }

  const rateLimit = await checkRateLimit({
    route: "api:email:send",
    key: `${tenantId}:${user.id}`,
    limit: 20,
    windowSeconds: 60,
    tenantId,
    actorUserId: user.id,
    metadata: {
      recipientCount: recipients.length,
    },
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many email sends. Try again later." },
      {
        status: 429,
        headers: {
          "retry-after": Math.max(
            1,
            Math.ceil(
              (new Date(rateLimit.resetAt).getTime() - Date.now()) / 1000,
            ),
          ).toString(),
        },
      },
    );
  }

  const result = await sendTenantEmail({
    tenantId,
    actorUserId: user.id,
    to: recipients,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    template: "api_email_send",
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json({
    id: result.providerMessageId,
    emailMessageId: result.emailMessageId,
  });
}
