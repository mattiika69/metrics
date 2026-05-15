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
        <div className="auth-heading">
          <h1>HyperOptimal</h1>
          <p>Sign in to your account</p>
        </div>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <form action={signInAction} className="auth-form">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <label className="auth-field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="auth-field">
            <span className="auth-label-row">
              Password
              <Link href="/forgot-password">Forgot password?</Link>
            </span>
            <span className="auth-password-wrap">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
              <span className="auth-eye" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M2.4 12s3.4-5.7 9.6-5.7 9.6 5.7 9.6 5.7-3.4 5.7-9.6 5.7S2.4 12 2.4 12Z" />
                  <circle cx="12" cy="12" r="2.8" />
                </svg>
              </span>
            </span>
          </label>
          <button type="submit">Sign in</button>
        </form>
        <p className="auth-switch">
          Don&apos;t have an account? <Link href={signupHref}>Sign up</Link>
        </p>
      </section>
    </main>
  );
}
