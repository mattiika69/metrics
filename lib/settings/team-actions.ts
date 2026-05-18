"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendTenantEmail } from "@/lib/email/send";
import {
  escapeEmailHtml,
  productEmailSubject,
  productEmailText,
} from "@/lib/email/templates";
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

type TeamRole = "owner" | "admin" | "member";

type TeamMembershipRow = {
  tenant_id: string;
  user_id: string;
  role: TeamRole;
};

type InvitationRow = {
  id: string;
  tenant_id: string;
  email: string;
  role: "admin" | "member";
  status: string;
  expires_at: string;
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

function membershipRole(value: string): TeamRole | null {
  if (value === "owner" || value === "admin" || value === "member") return value;
  return null;
}

function hashInvitationToken(token: string) {
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

async function sendInvitationEmail(input: {
  tenantId: string;
  actorUserId: string;
  tenantName: string;
  toEmail: string;
  inviteUrl: string;
  role: "admin" | "member";
}) {
  const subject = productEmailSubject("team_invited");
  const safeTenantName = escapeEmailHtml(input.tenantName);
  const safeInviteUrl = escapeEmailHtml(input.inviteUrl);
  const safeRole = escapeEmailHtml(input.role);
  const text = productEmailText(
    "team_invited",
    `You were invited as ${input.role} in ${input.tenantName}. Accept the invitation here: ${input.inviteUrl}`,
  );
  const html = `
    <p>You were invited to join <strong>${safeTenantName}</strong> in HyperOptimal Metrics.</p>
    <p>Role: <strong>${safeRole}</strong></p>
    <p><a href="${safeInviteUrl}">Accept invitation</a></p>
  `;
  const result = await sendTenantEmail({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    to: [input.toEmail],
    subject,
    text,
    html,
    template: "team_invited",
    metadata: {
      role: input.role,
    },
  });
  const admin = createAdminClient();

  await admin
    .from("tenant_invitations")
    .update({
      email_delivery_status: result.ok ? "sent" : "failed",
      email_delivery_error: result.error,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("email", input.toEmail)
    .eq("status", "pending");

  if (!result.ok) {
    throw new Error(result.error ?? "Unable to send invitation email.");
  }
}

async function getTargetMembership(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("tenant_id, user_id, role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as TeamMembershipRow | null;
}

async function getOwnerCount(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
) {
  const { count, error } = await admin
    .from("tenant_memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "owner");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function acceptInvitationRecord(input: {
  invitation: InvitationRow;
  userId: string;
  email: string;
}) {
  const admin = createAdminClient();
  const invitation = input.invitation;

  if (invitation.status !== "pending") {
    redirectWith("/settings/team/accept", "error", "Invitation is no longer pending.");
  }

  if (invitation.email !== input.email) {
    redirectWith("/settings/team/accept", "error", "Log in with the invited email address.");
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await admin
      .from("tenant_invitations")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);
    redirectWith("/settings/team/accept", "error", "Invitation has expired.");
  }

  const existingMembership = await getTargetMembership(
    admin,
    invitation.tenant_id,
    input.userId,
  );
  const role = existingMembership?.role === "owner" ? "owner" : invitation.role;
  const { error: membershipError } = await admin.from("tenant_memberships").upsert(
    {
      tenant_id: invitation.tenant_id,
      user_id: input.userId,
      role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,user_id" },
  );

  if (membershipError) {
    redirectWith("/settings/team/accept", "error", membershipError.message);
  }

  const { error: invitationError } = await admin
    .from("tenant_invitations")
    .update({
      status: "accepted",
      accepted_by_user_id: input.userId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id)
    .eq("status", "pending");

  if (invitationError) {
    redirectWith("/settings/team/accept", "error", invitationError.message);
  }

  await logAuditEvent({
    tenantId: invitation.tenant_id,
    actorUserId: input.userId,
    eventType: "team_invitation_accepted",
    targetType: "tenant_invitation",
    targetId: invitation.id,
    metadata: { role },
  });

  redirectWith("/settings/team", "message", "Invitation accepted.");
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

export async function updateTeamMemberRoleAction(formData: FormData) {
  const targetUserId = formValue(formData, "userId");
  const role = membershipRole(formValue(formData, "role"));
  const { user, tenant, membership } = await requireTenant();

  if (!isTeamAdmin(membership.role)) {
    redirectWith("/settings/team", "error", "Only admins can update team members.");
  }

  if (!targetUserId || !role) {
    redirectWith("/settings/team", "error", "Team member and role are required.");
  }

  if (targetUserId === user.id) {
    redirectWith("/settings/team", "error", "You cannot change your own role.");
  }

  if (role === "owner" && membership.role !== "owner") {
    redirectWith("/settings/team", "error", "Only owners can grant owner access.");
  }

  const admin = createAdminClient();
  let target: TeamMembershipRow | null = null;
  try {
    target = await getTargetMembership(admin, tenant.id, targetUserId);
  } catch (error) {
    redirectWith(
      "/settings/team",
      "error",
      error instanceof Error ? error.message : "Unable to load team member.",
    );
  }

  if (!target) {
    redirectWith("/settings/team", "error", "Team member was not found.");
  }

  if (target.role === "owner" && membership.role !== "owner") {
    redirectWith("/settings/team", "error", "Only owners can change owner permissions.");
  }

  if (target.role === "owner" && role !== "owner") {
    const ownerCount = await getOwnerCount(admin, tenant.id);
    if (ownerCount <= 1) {
      redirectWith("/settings/team", "error", "Workspace must keep at least one owner.");
    }
  }

  const { error } = await admin
    .from("tenant_memberships")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenant.id)
    .eq("user_id", targetUserId);

  if (error) {
    redirectWith("/settings/team", "error", error.message);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "team_member_role_changed",
    targetType: "tenant_membership",
    targetId: targetUserId,
    metadata: {
      previousRole: target.role,
      role,
    },
  });

  redirectWith("/settings/team", "message", "Team member role updated.");
}

export async function removeTeamMemberAction(formData: FormData) {
  const targetUserId = formValue(formData, "userId");
  const { user, tenant, membership } = await requireTenant();

  if (!isTeamAdmin(membership.role)) {
    redirectWith("/settings/team", "error", "Only admins can remove team members.");
  }

  if (!targetUserId) {
    redirectWith("/settings/team", "error", "Team member is required.");
  }

  if (targetUserId === user.id) {
    redirectWith("/settings/team", "error", "You cannot remove yourself.");
  }

  const admin = createAdminClient();
  let target: TeamMembershipRow | null = null;
  try {
    target = await getTargetMembership(admin, tenant.id, targetUserId);
  } catch (error) {
    redirectWith(
      "/settings/team",
      "error",
      error instanceof Error ? error.message : "Unable to load team member.",
    );
  }

  if (!target) {
    redirectWith("/settings/team", "error", "Team member was not found.");
  }

  if (target.role === "owner" && membership.role !== "owner") {
    redirectWith("/settings/team", "error", "Only owners can remove owners.");
  }

  if (target.role === "owner") {
    const ownerCount = await getOwnerCount(admin, tenant.id);
    if (ownerCount <= 1) {
      redirectWith("/settings/team", "error", "Workspace must keep at least one owner.");
    }
  }

  const { error } = await admin
    .from("tenant_memberships")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("user_id", targetUserId);

  if (error) {
    redirectWith("/settings/team", "error", error.message);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "team_member_removed",
    targetType: "tenant_membership",
    targetId: targetUserId,
    metadata: {
      previousRole: target.role,
    },
  });

  redirectWith("/settings/team", "message", "Team member removed.");
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

export async function acceptTeamInvitationByEmailAction(formData: FormData) {
  const invitationId = formValue(formData, "invitationId");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/settings/team/accept")}`);
  }

  const email = normalizeEmail(user.email ?? "");
  if (!email) {
    redirectWith(
      "/settings/team/accept",
      "error",
      "Your account needs an email address to accept this invitation.",
    );
  }

  const admin = createAdminClient();
  let query = admin
    .from("tenant_invitations")
    .select("id, tenant_id, email, role, status, expires_at")
    .eq("email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (invitationId) {
    query = query.eq("id", invitationId);
  }

  const { data, error } = await query;
  if (error) {
    redirectWith("/settings/team/accept", "error", error.message);
  }

  const invitation = (data?.[0] ?? null) as InvitationRow | null;
  if (!invitation) {
    redirectWith(
      "/settings/team/accept",
      "error",
      "No pending invitation was found for this email address.",
    );
  }

  await acceptInvitationRecord({
    invitation,
    userId: user.id,
    email,
  });
}
