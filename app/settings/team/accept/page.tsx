import { createHash } from "node:crypto";
import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { authRedirectParam } from "@/lib/auth/redirects";
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
  status: "pending" | "accepted" | "revoked" | "expired";
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

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function tenantName(invitation: PendingInvitation) {
  const tenant = Array.isArray(invitation.tenants)
    ? invitation.tenants[0]
    : invitation.tenants;
  return tenant?.name ?? "this workspace";
}

function isExpired(invitation: Pick<PendingInvitation, "expires_at">) {
  return new Date(invitation.expires_at).getTime() < Date.now();
}

function authHref(path: "/login" | "/signup", next: string, email: string) {
  const params = new URLSearchParams();
  params.set(authRedirectParam, next);
  if (email) params.set("email", email);
  return `${path}?${params.toString()}`;
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
  const signedInEmail = user?.email?.toLowerCase() ?? "";
  let tokenInvitation: PendingInvitation | null = null;
  let pendingInvitations: PendingInvitation[] = [];

  if (token) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("tenant_invitations")
      .select("id, email, role, status, expires_at, tenants(name)")
      .eq("token_hash", hashInvitationToken(token))
      .maybeSingle();
    tokenInvitation = (data ?? null) as PendingInvitation | null;
  }

  if (!token && user?.email) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("tenant_invitations")
      .select("id, email, role, status, expires_at, tenants(name)")
      .eq("email", user.email.toLowerCase())
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);
    pendingInvitations = (data ?? []) as PendingInvitation[];
  }

  const tokenEmail = tokenInvitation?.email ?? "";
  const tokenWorkspace = tokenInvitation ? tenantName(tokenInvitation) : "";
  const tokenExpired = tokenInvitation ? isExpired(tokenInvitation) : false;
  const tokenPending = tokenInvitation?.status === "pending" && !tokenExpired;
  const wrongAccount = Boolean(
    tokenInvitation &&
      user &&
      signedInEmail &&
      signedInEmail !== tokenInvitation.email,
  );

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Team invitation</p>
        <h1>
          {tokenInvitation ? `Join ${tokenWorkspace}` : "Join team"}
        </h1>
        <p className="lede">
          {tokenInvitation
            ? `This invitation was sent to ${tokenEmail}.`
            : "Accept the invitation with the same email address that received it."}
        </p>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        {token && !tokenInvitation ? (
          <p className="notice error">
            This invitation link is not valid. Ask the workspace owner to send a new invitation.
          </p>
        ) : null}
        {tokenInvitation && tokenExpired ? (
          <p className="notice error">
            This invitation has expired. Ask the workspace owner to send a new invitation.
          </p>
        ) : null}
        {tokenInvitation && tokenInvitation.status === "accepted" ? (
          <p className="notice">
            This invitation has already been accepted. Sign in with {tokenEmail} to open
            the workspace.
          </p>
        ) : null}
        {tokenInvitation && tokenInvitation.status === "revoked" ? (
          <p className="notice error">
            This invitation was revoked. Ask the workspace owner to send a new invitation.
          </p>
        ) : null}
        {wrongAccount ? (
          <div className="notice error">
            <p>
              You are signed in as {signedInEmail}. This invitation belongs to {tokenEmail}.
            </p>
            <form action={signOutAction} className="form-stack">
              <input type="hidden" name="next" value={next} />
              <button type="submit">Sign out</button>
            </form>
          </div>
        ) : null}
        {!token && !user ? (
          <p className="notice">
            Sign in with the invited email address and we&apos;ll check for pending invitations.
          </p>
        ) : null}
        {token && user && tokenPending && !wrongAccount ? (
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
        {tokenInvitation && tokenPending && !user ? (
          <div className="button-row">
            <Link
              href={authHref("/login", next, tokenEmail)}
              className="button-primary"
            >
              Log in
            </Link>
            <Link
              href={authHref("/signup", next, tokenEmail)}
              className="button-secondary"
            >
              Create account
            </Link>
          </div>
        ) : null}
        {!token && !user ? (
          <div className="button-row">
            <Link
              href={`/login?${authRedirectParam}=%2Fsettings%2Fteam%2Faccept`}
              className="button-primary"
            >
              Log in
            </Link>
            <Link
              href={`/signup?${authRedirectParam}=%2Fsettings%2Fteam%2Faccept`}
              className="button-secondary"
            >
              Create account
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
