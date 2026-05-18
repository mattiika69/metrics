import Link from "next/link";
import {
  acceptTeamInvitationAction,
  acceptTeamInvitationByEmailAction,
} from "@/lib/settings/team-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

type PendingInvitation = {
  id: string;
  email: string;
  role: "admin" | "member";
  expires_at: string;
  tenants:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

function tenantName(invitation: PendingInvitation) {
  const tenant = Array.isArray(invitation.tenants)
    ? invitation.tenants[0]
    : invitation.tenants;
  return tenant?.name ?? "this workspace";
}

export default async function AcceptTeamInvitationPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const token = getParam(params, "token") ?? "";
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const next = `/settings/team/accept?token=${encodeURIComponent(token)}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let pendingInvitations: PendingInvitation[] = [];

  if (!token && user?.email) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("tenant_invitations")
      .select("id, email, role, expires_at, tenants(name)")
      .eq("email", user.email.toLowerCase())
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);
    pendingInvitations = (data ?? []) as PendingInvitation[];
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Team invitation</p>
        <h1>Join team</h1>
        <p className="lede">
          Accept the invitation with the same email address that received it.
        </p>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        {!token && !user ? (
          <p className="notice">
            Sign in with the invited email address and we&apos;ll check for pending invitations.
          </p>
        ) : null}
        {token && user ? (
          <form action={acceptTeamInvitationAction} className="form-stack">
            <input type="hidden" name="token" value={token} />
            <button type="submit">Accept invitation</button>
          </form>
        ) : null}
        {!token && user ? (
          pendingInvitations.length ? (
            <div className="invite-list">
              {pendingInvitations.map((invitation) => (
                <form
                  action={acceptTeamInvitationByEmailAction}
                  className="invite-card"
                  key={invitation.id}
                >
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <div>
                    <strong>{tenantName(invitation)}</strong>
                    <span>
                      {invitation.role} invitation · expires{" "}
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button type="submit">Accept invitation</button>
                </form>
              ))}
            </div>
          ) : (
            <p className="notice error">
              No pending invitation was found for {user.email}.
            </p>
          )
        ) : null}
        {token && !user ? (
          <div className="button-row">
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="button-primary"
            >
              Log in
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(next)}`}
              className="button-secondary"
            >
              Create account
            </Link>
          </div>
        ) : null}
        {!token && !user ? (
          <div className="button-row">
            <Link href="/login?next=%2Fsettings%2Fteam%2Faccept" className="button-primary">
              Log in
            </Link>
            <Link href="/signup?next=%2Fsettings%2Fteam%2Faccept" className="button-secondary">
              Create account
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
