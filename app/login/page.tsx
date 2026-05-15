import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";
import { signInAction } from "@/lib/auth/actions";

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

export default async function LoginPage({ searchParams }: PageProps) {
  if (isAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const next = getParam(params, "next");
  const signupHref = next
    ? `/signup?next=${encodeURIComponent(next)}`
    : "/signup";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">HyperOptimal Metrics</p>
        <h1>Log in</h1>
        <p className="lede">Access your workspace, reports, and admin tools.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <form action={signInAction} className="form-stack">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit">Log in</button>
        </form>
        <div className="link-row">
          <Link href="/forgot-password">Reset password</Link>
          <Link href={signupHref}>Create account</Link>
        </div>
      </section>
    </main>
  );
}
