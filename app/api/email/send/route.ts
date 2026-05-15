import { createResendClient, getDefaultFromEmail } from "@/lib/email/resend";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SendEmailPayload = {
  tenantId?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as SendEmailPayload;
  const tenantId = payload.tenantId;
  const recipients = Array.isArray(payload.to)
    ? payload.to
    : payload.to
      ? [payload.to]
      : [];

  if (!tenantId || recipients.length === 0 || !payload.subject) {
    return Response.json(
      { error: "tenantId, to, and subject are required." },
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

  const resend = createResendClient();
  const from = getDefaultFromEmail();
  const email = payload.html
    ? {
        from,
        to: recipients,
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
      }
    : {
        from,
        to: recipients,
        subject: payload.subject,
        text: payload.text as string,
      };

  const result = await resend.emails.send(email);

  const admin = createAdminClient();
  await admin.from("email_messages").insert({
    tenant_id: tenantId,
    created_by: user.id,
    provider: "resend",
    provider_message_id: result.data?.id ?? null,
    from_email: from,
    to_emails: recipients,
    subject: payload.subject,
    status: result.error ? "error" : "sent",
    payload: {
      error: result.error,
    },
  });

  if (result.error) {
    await logAuditEvent({
      tenantId,
      actorUserId: user.id,
      eventType: "email_send_failed",
      targetType: "email_message",
      metadata: {
        subject: payload.subject,
        recipientCount: recipients.length,
        error: result.error.message,
      },
    });
    return Response.json({ error: result.error.message }, { status: 502 });
  }

  await logAuditEvent({
    tenantId,
    actorUserId: user.id,
    eventType: "email_sent",
    targetType: "email_message",
    targetId: result.data?.id ?? null,
    metadata: {
      subject: payload.subject,
      recipientCount: recipients.length,
    },
  });

  return Response.json({ id: result.data?.id });
}
