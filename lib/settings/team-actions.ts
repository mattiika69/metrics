"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createResendClient, getDefaultFromEmail } from "@/lib/email/resend";
import { productEmailSubject, productEmailText } from "@/lib/email/templates";
import { requireTenant } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AcceptedInvitation = {
  accepted_tenant_id: string;
  invitation_id: string;
  accepted_role: "admin" | "member";
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWith(path: string, key: "error" | "message", value: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${key}=${encodeURIComponent(value)}`);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isTeamAdmin(role: string) {
  return role === "owner" || role === "admin";
}

function invitationRole(value: string) {
  return value === "admin" ? "admin" : "member";
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getOrigin() {
  return (
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

async function sendInvitationEmail(input: {
  tenantId: string;
  actorUserId: string;
  tenantName: string;
  toEmail: string;
  inviteUrl: string;
  role: "admin" | "member";
}) {
  const resend = createResendClient();
  const from = getDefaultFromEmail();
  const subject = productEmailSubject("team_invited");
  const text = productEmailText(
    "team_invited",
    `You were invited as ${input.role} in ${input.tenantName}. Accept the invitation here: ${input.inviteUrl}`,
  );
  const html = `
    <p>You were invited to join <strong>${input.tenantName}</strong> in HyperOptimal Metrics.</p>
    <p>Role: <strong>${input.role}</strong></p>
    <p><a href="${input.inviteUrl}">Accept invitation</a></p>
  `;
  const result = await resend.emails.send({
    from,
    to: [input.toEmail],
    subject,
    text,
    html,
  });
  const admin = createAdminClient();

  await admin.from("email_messages").insert({
    tenant_id: input.tenantId,
    created_by: input.actorUserId,
    provider: "resend",
    provider_message_id: result.data?.id ?? null,
    from_email: from,
    to_emails: [input.toEmail],
    subject,
    status: result.error ? "error" : "sent",
    payload: {
      template: "team_invited",
      error: result.error,
    },
  });

  await admin
    .from("tenant_invitations")
    .update({
      email_delivery_status: result.error ? "failed" : "sent",
      email_delivery_error: result.error?.message ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("email", input.toEmail)
    .eq("tenant_id", input.tenantId)
    .eq("status", "pending");

  if (result.error) {
    throw new Error(result.error.message);
  }

  await logAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    eventType: "email_sent",
    targetType: "team_invitation",
    targetId: result.data?.id ?? null,
    metadata: {
      template: "team_invited",
      recipient: input.toEmail,
      role: input.role,
    },
  });
}

export async function inviteTeamMemberAction(formData: FormData) {
  const email = normalizeEmail(formValue(formData, "email"));
  const role = invitationRole(formValue(formData, "role"));
  const { user, tenant, membership } = await requireTenant();

  if (!isTeamAdmin(membership.role)) {
    redirectWith("/settings/team", "error", "Only admins can invite team members.");
  }

  if (!email || !email.includes("@")) {
    redirectWith("/settings/team", "error", "Enter a valid email address.");
  }

  const rateLimit = await checkRateLimit({
    route: "settings:team_invite",
    key: `${tenant.id}:${user.id}`,
    limit: 20,
    windowSeconds: 3600,
    tenantId: tenant.id,
    actorUserId: user.id,
    metadata: {
      email,
      role,
    },
  });

  if (!rateLimit.allowed) {
    redirectWith(
      "/settings/team",
      "error",
      "Too many invitations. Try again later.",
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from("tenant_invitations")
    .insert({
      tenant_id: tenant.id,
      email,
      role,
      token_hash: tokenHash,
      invited_by_user_id: user.id,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    const message =
      error.code === "23505"
        ? "That email already has a pending invitation."
        : error.message;
    await logAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: "team_invitation_failed",
      targetType: "tenant_invitation",
      metadata: {
        email,
        role,
        error: message,
      },
    });
    redirectWith("/settings/team", "error", message);
  }

  const inviteUrl = `${await getOrigin()}/settings/team/accept?token=${encodeURIComponent(token)}`;

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "team_invitation_created",
    targetType: "tenant_invitation",
    targetId: invitation.id,
    metadata: {
      email,
      role,
      expiresAt,
    },
  });

  try {
    await sendInvitationEmail({
      tenantId: tenant.id,
      actorUserId: user.id,
      tenantName: tenant.name,
      toEmail: email,
      inviteUrl,
      role,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send invitation email.";
    await logAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: "team_invitation_email_failed",
      targetType: "tenant_invitation",
      targetId: invitation.id,
      metadata: {
        email,
        role,
        error: message,
      },
    });
    redirectWith(
      "/settings/team",
      "error",
      "Invitation was created, but the email could not be sent.",
    );
  }

  redirectWith("/settings/team", "message", "Invitation sent.");
}

export async function revokeTeamInvitationAction(formData: FormData) {
  const invitationId = formValue(formData, "invitationId");
  const { user, tenant, membership } = await requireTenant();

  if (!isTeamAdmin(membership.role)) {
    redirectWith("/settings/team", "error", "Only admins can revoke invitations.");
  }

  if (!invitationId) {
    redirectWith("/settings/team", "error", "Invitation is required.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_invitations")
    .update({
      status: "revoked",
      cancelled_at: new Date().toISOString(),
      cancelled_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("tenant_id", tenant.id)
    .eq("status", "pending");

  if (error) {
    redirectWith("/settings/team", "error", error.message);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "team_invitation_revoked",
    targetType: "tenant_invitation",
    targetId: invitationId,
  });

  redirectWith("/settings/team", "message", "Invitation revoked.");
}

export async function acceptTeamInvitationAction(formData: FormData) {
  const token = formValue(formData, "token");

  if (!token) {
    redirectWith("/settings/team/accept", "error", "Invitation token is required.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/settings/team/accept?token=${token}`)}`);
  }

  const { data, error } = await supabase
    .rpc("accept_tenant_invitation", {
      invitation_token: token,
    })
    .single();

  if (error || !data) {
    redirectWith(
      `/settings/team/accept?token=${encodeURIComponent(token)}`,
      "error",
      error?.message ?? "Unable to accept invitation.",
    );
  }

  const accepted = data as AcceptedInvitation;
  await logAuditEvent({
    tenantId: accepted.accepted_tenant_id,
    actorUserId: user.id,
    eventType: "team_invitation_accepted",
    targetType: "tenant_invitation",
    targetId: accepted.invitation_id,
    metadata: {
      role: accepted.accepted_role,
    },
  });

  redirectWith("/settings/team", "message", "Invitation accepted.");
}
