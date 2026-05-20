import { createHash } from "node:crypto";
import { sendRoezanMessage } from "@/lib/sms/roezan";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SendSmsPayload = {
  tenantId?: string;
  phone?: string;
  message?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  media?: string[];
};

function hashRecipient(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex").slice(0, 16);
}

function canSendTenantSms(role: string | null | undefined) {
  return role === "owner" || role === "admin";
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as SendSmsPayload | null;
  if (!payload) {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload.tenantId || !payload.phone || !payload.message) {
    return Response.json(
      { error: "tenantId, phone, and message are required." },
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

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", payload.tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return Response.json(
      { error: "Unable to verify tenant access." },
      { status: 400 },
    );
  }

  if (!membership) {
    return Response.json({ error: "Tenant access denied." }, { status: 403 });
  }

  if (!canSendTenantSms(membership.role)) {
    return Response.json(
      { error: "Only workspace admins can send SMS." },
      { status: 403 },
    );
  }

  const rateLimit = await checkRateLimit({
    route: "api:sms:send",
    key: `${payload.tenantId}:${user.id}`,
    limit: 10,
    windowSeconds: 60,
    tenantId: payload.tenantId,
    actorUserId: user.id,
    metadata: {
      phoneHash: hashRecipient(payload.phone),
    },
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many SMS sends. Try again later." },
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

  const result = await sendRoezanMessage({
    phone: payload.phone,
    message: payload.message,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    media: payload.media,
  });

  const admin = createAdminClient();
  await admin.from("sms_messages").insert({
    tenant_id: payload.tenantId,
    created_by: user.id,
    provider: "roezan",
    to_phone: payload.phone,
    body: payload.message,
    status: result.ok ? "sent" : "error",
    payload: {
      request: {
        firstName: payload.firstName ?? null,
        lastName: payload.lastName ?? null,
        email: payload.email ?? null,
        media: payload.media ?? [],
      },
      response: result.data,
      responseStatus: result.status,
    },
  });

  if (!result.ok) {
    await logAuditEvent({
      tenantId: payload.tenantId,
      actorUserId: user.id,
      eventType: "sms_send_failed",
      targetType: "sms_message",
      metadata: {
        phoneHash: hashRecipient(payload.phone),
        responseStatus: result.status,
      },
    });
    return Response.json(
      { error: "Roezan send failed.", details: result.data },
      { status: 502 },
    );
  }

  await logAuditEvent({
    tenantId: payload.tenantId,
    actorUserId: user.id,
    eventType: "sms_sent",
    targetType: "sms_message",
    metadata: {
      phoneHash: hashRecipient(payload.phone),
      responseStatus: result.status,
    },
  });

  return Response.json({ sent: true, provider: "roezan" });
}
