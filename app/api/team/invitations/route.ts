import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { requireAdminContext, routeIdFromUrl } from "@/lib/api/context";
import { createResendClient, getDefaultFromEmail } from "@/lib/email/resend";
import { productEmailSubject, productEmailText } from "@/lib/email/templates";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function invitationRole(value: unknown) {
  return value === "admin" ? "admin" : "member";
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getOrigin() {
  return (
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

export async function GET() {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { data, error } = await context.supabase
    .from("tenant_invitations")
    .select("id, email, role, status, email_delivery_status, email_delivery_error, expires_at, created_at")
    .eq("tenant_id", context.tenant.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ invitations: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const payload = await request.json().catch(() => ({}));
  const email = normalizeEmail(payload.email);
  const role = invitationRole(payload.role);

  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from("tenant_invitations")
    .insert({
      tenant_id: context.tenant.id,
      email,
      role,
      token_hash: tokenHash(rawToken),
      invited_by_user_id: context.user.id,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "team_invitation_created",
    targetType: "tenant_invitation",
    targetId: invitation.id,
    metadata: { email, role },
  });

  const inviteUrl = `${await getOrigin()}/invite/accept?token=${encodeURIComponent(rawToken)}`;

  try {
    const resend = createResendClient();
    const from = getDefaultFromEmail();
    const subject = productEmailSubject("team_invited");
    const text = productEmailText(
      "team_invited",
      `Accept the invitation here: ${inviteUrl}`,
    );
    const result = await resend.emails.send({
      from,
      to: [email],
      subject,
      text,
      html: `<p>You were invited to join <strong>${context.tenant.name}</strong> in HyperOptimal Metrics.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
    });

    await admin
      .from("tenant_invitations")
      .update({
        email_delivery_status: result.error ? "failed" : "sent",
        email_delivery_error: result.error?.message ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    await admin.from("email_messages").insert({
      tenant_id: context.tenant.id,
      created_by: context.user.id,
      provider: "resend",
      provider_message_id: result.data?.id ?? null,
      from_email: from,
      to_emails: [email],
      subject,
      status: result.error ? "error" : "sent",
      payload: { template: "team_invited", error: result.error },
    });

    if (result.error) throw new Error(result.error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send invitation.";
    await admin
      .from("tenant_invitations")
      .update({
        email_delivery_status: "failed",
        email_delivery_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    await logAuditEvent({
      tenantId: context.tenant.id,
      actorUserId: context.user.id,
      eventType: "team_invitation_email_failed",
      targetType: "tenant_invitation",
      targetId: invitation.id,
      metadata: { email, role, error: message },
    });

    return Response.json(
      { id: invitation.id, emailDeliveryStatus: "failed", error: message },
      { status: 202 },
    );
  }

  return Response.json({ id: invitation.id, emailDeliveryStatus: "sent" }, { status: 201 });
}

export async function DELETE(request: Request) {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const invitationId = routeIdFromUrl(request);
  if (!invitationId) return Response.json({ error: "Invitation id is required." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_invitations")
    .update({
      status: "revoked",
      cancelled_at: new Date().toISOString(),
      cancelled_by_user_id: context.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("tenant_id", context.tenant.id)
    .eq("status", "pending");

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "team_invitation_revoked",
    targetType: "tenant_invitation",
    targetId: invitationId,
  });

  return Response.json({ ok: true });
}
