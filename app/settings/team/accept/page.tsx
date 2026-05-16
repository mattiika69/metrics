import Link from "next/link";
import { acceptTeamInvitationAction } from "@/lib/settings/team-actions";
import { createClient } from "@/lib/supabase/server";

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

export default async function AcceptTeamInvitationPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const token = getParam(params, "token") ?? "";
  const error = getParam(params, "error");
  const next = `/settings/team/accept?token=${encodeURIComponent(token)}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Team invitation</p>
        <h1>Join team</h1>
        <p className="lede">
          Accept the invitation with the same email address that received it.
        </p>
        {error ? <p className="notice error">{error}</p> : null}
        {!token ? <p className="notice error">Invitation token is missing.</p> : null}
        {token && user ? (
          <form action={acceptTeamInvitationAction} className="form-stack">
            <input type="hidden" name="token" value={token} />
            <button type="submit">Accept invitation</button>
          </form>
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
      </section>
    </main>
  );
}
