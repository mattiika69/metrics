import { sendRoezanMessage } from "@/lib/sms/roezan";
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

export async function POST(request: Request) {
  const payload = (await request.json()) as SendSmsPayload;

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

  const { data: isMember } = await supabase.rpc("is_tenant_member", {
    target_tenant_id: payload.tenantId,
  });

  if (!isMember) {
    return Response.json({ error: "Tenant access denied." }, { status: 403 });
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
    return Response.json(
      { error: "Roezan send failed.", details: result.data },
      { status: 502 },
    );
  }

  return Response.json({ sent: true, provider: "roezan" });
}
