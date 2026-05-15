import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";
import {
  inviteTeamMemberAction,
  revokeTeamInvitationAction,
} from "@/lib/settings/team-actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Profile = {
  user_id: string;
  email: string;
  full_name: string | null;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function canManageTeam(role: string) {
  return role === "owner" || role === "admin";
}

export default async function TeamSettingsPage({ searchParams }: PageProps) {
  const { supabase, user, tenant, membership } = await requireTenant();
  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const isAdmin = canManageTeam(membership.role);
  const { data: members } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, user_id, role, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: true });
  const memberUserIds = members?.map((member) => member.user_id) ?? [];
  const { data: profiles } = memberUserIds.length
    ? await supabase
        .from("user_profiles")
        .select("user_id, email, full_name")
        .in("user_id", memberUserIds)
    : { data: [] as Profile[] };
  const profileByUserId = new Map(
    (profiles as Profile[] | null)?.map((profile) => [profile.user_id, profile]) ??
      [],
  );
  const { data: invitations } = isAdmin
    ? await supabase
        .from("tenant_invitations")
        .select("id, email, role, status, expires_at, created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <AppShell active="settings" tenantName={tenant.name}>
      <section className="page-header">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Settings</h1>
        <p className="lede">Manage workspace access and tenant controls.</p>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>
      <nav className="settings-tabs" aria-label="Settings">
        <Link href="/settings/team" className="active">
          Team
        </Link>
      </nav>
      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Team</p>
              <h2>Members</h2>
            </div>
            <span className="muted">{members?.length ?? 0} active</span>
          </div>
          <div className="table-list">
            {members?.map((member) => {
              const profile = profileByUserId.get(member.user_id);

              return (
                <div className="table-row" key={member.user_id}>
                  <div>
                    <strong>
                      {profile?.full_name || profile?.email || member.user_id}
                    </strong>
                    <span className="muted">
                      {member.user_id === user.id ? "You" : profile?.email}
                    </span>
                  </div>
                  <span className="pill">{member.role}</span>
                </div>
              );
            })}
          </div>
        </article>
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Invite</p>
              <h2>Add team member</h2>
            </div>
          </div>
          {isAdmin ? (
            <form action={inviteTeamMemberAction} className="form-stack compact">
              <label>
                Email
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                Role
                <select name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button type="submit">Send invitation</button>
            </form>
          ) : (
            <p className="muted">Only workspace admins can invite team members.</p>
          )}
        </article>
        {isAdmin ? (
          <article className="settings-panel full-span">
            <div className="panel-heading">
              <div>
                <p className="step-label">Pending</p>
                <h2>Invitations</h2>
              </div>
            </div>
            <div className="table-list">
              {invitations?.length ? (
                invitations.map((invitation) => (
                  <div className="table-row" key={invitation.id}>
                    <div>
                      <strong>{invitation.email}</strong>
                      <span className="muted">
                        {invitation.status} until{" "}
                        {new Date(invitation.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="row-actions">
                      <span className="pill">{invitation.role}</span>
                      {invitation.status === "pending" ? (
                        <form action={revokeTeamInvitationAction}>
                          <input
                            type="hidden"
                            name="invitationId"
                            value={invitation.id}
                          />
                          <button type="submit" className="button-secondary">
                            Revoke
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No pending invitations.</p>
              )}
            </div>
          </article>
        ) : null}
      </section>
    </AppShell>
  );
}
