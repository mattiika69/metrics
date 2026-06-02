import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { isValidEmailAddress, sendTenantEmail } from "@/lib/email/send";
import {
  escapeEmailHtml,
  productEmailSubject,
  productEmailText,
} from "@/lib/email/templates";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/urls/app";

type TeamRole = "admin" | "member";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function existingMemberByEmail({
  tenantId,
  email,
}: {
  tenantId: string;
  email: string;
}) {
  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("email", email)
    .limit(10);
  if (profileError) throw new Error(profileError.message);
  const userIds = profiles?.map((profile) => profile.user_id).filter(Boolean) ?? [];
  if (!userIds.length) return null;

  const { data: memberships, error } = await admin
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("user_id", userIds)
    .limit(1);
  if (error) throw new Error(error.message);
  return memberships?.[0] ?? null;
}

export async function createApprovedTeamInvitation({
  tenantId,
  tenantName,
  actorUserId,
  email,
  role,
  source,
}: {
  tenantId: string;
  tenantName: string;
  actorUserId: string;
  email: string;
  role: TeamRole;
  source: "agent" | "team_settings";
}) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmailAddress(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  const existingMember = await existingMemberByEmail({ tenantId, email: normalizedEmail });
  if (existingMember) {
    throw new Error("That email is already a team member.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from("tenant_invitations")
    .insert({
      tenant_id: tenantId,
      email: normalizedEmail,
      role,
      token_hash: hashInvitationToken(token),
      invited_by_user_id: actorUserId,
      expires_at: expiresAt,
      email_delivery_status: "queued",
      email_delivery_error: null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.code === "23505" ? "That email already has a pending invitation." : error.message);
  }

  const inviteUrl = `${await getAppBaseUrl()}/settings/team/accept?token=${encodeURIComponent(token)}`;
  const subject = productEmailSubject("team_invited");
  const text = productEmailText(
    "team_invited",
    `You were invited as ${role} in ${tenantName}. Accept the invitation here: ${inviteUrl}`,
  );
  const html = `
    <p>You were invited to join <strong>${escapeEmailHtml(tenantName)}</strong> in HyperOptimal Metrics.</p>
    <p>Role: <strong>${escapeEmailHtml(role)}</strong></p>
    <p><a href="${escapeEmailHtml(inviteUrl)}">Accept invitation</a></p>
  `;

  const result = await sendTenantEmail({
    tenantId,
    actorUserId,
    to: [normalizedEmail],
    subject,
    text,
    html,
    template: "team_invited",
    idempotencyKey: `team-invite:${tenantId}:${invitation.id}`,
    metadata: { role, source },
  });

  await admin
    .from("tenant_invitations")
    .update({
      email_delivery_status: result.ok ? "sent" : "failed",
      email_delivery_error: result.error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  await logAuditEvent({
    tenantId,
    actorUserId,
    eventType: result.ok ? "team_invitation_created" : "team_invitation_email_failed",
    targetType: "tenant_invitation",
    targetId: invitation.id,
    metadata: {
      email: normalizedEmail,
      role,
      source,
      expiresAt,
      error: result.error,
    },
  });

  if (!result.ok) {
    throw new Error(result.error ?? "Unable to send invitation email.");
  }

  return { id: invitation.id as string, email: normalizedEmail, role };
}
