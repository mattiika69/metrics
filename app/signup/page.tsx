import Link from "next/link";
import { redirect } from "next/navigation";
import { signUpAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";

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

function isInviteNext(next: string | undefined) {
  return Boolean(next?.startsWith("/settings/team/accept"));
}

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = getParam(params, "next");

  if (isAuthBypassEnabled() && !isInviteNext(next)) {
    redirect("/dashboard");
  }

  const email = getParam(params, "email") ?? "";
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const isInviteFlow = Boolean(next?.startsWith("/settings/team/accept"));
  const loginParams = new URLSearchParams();
  if (next) loginParams.set("next", next);
  if (email) loginParams.set("email", email);
  const loginQuery = loginParams.toString();
  const loginHref = loginQuery ? `/login?${loginQuery}` : "/login";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-heading">
          <h1>HyperOptimal</h1>
          <p>
            {isInviteFlow
              ? "Create your account to join the workspace"
              : "Create your account"}
          </p>
        </div>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        <form action={signUpAction} className="auth-form">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {isInviteFlow ? (
            <input type="hidden" name="organizationName" value="" />
          ) : (
            <label className="auth-field">
              Organization Name
              <input
                name="organizationName"
                placeholder="Your company name"
                autoComplete="organization"
                required
              />
            </label>
          )}
          <div className="auth-two-col">
            <label className="auth-field">
              First Name
              <input name="firstName" placeholder="First name" autoComplete="given-name" />
            </label>
            <label className="auth-field">
              Last Name
              <input name="lastName" placeholder="Last name" autoComplete="family-name" />
            </label>
          </div>
          <label className="auth-field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={email}
              required
            />
          </label>
          <label className="auth-field">
            Password
            <span className="auth-password-wrap">
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <span className="auth-eye" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M2.4 12s3.4-5.7 9.6-5.7 9.6 5.7 9.6 5.7-3.4 5.7-9.6 5.7S2.4 12 2.4 12Z" />
                  <circle cx="12" cy="12" r="2.8" />
                </svg>
              </span>
            </span>
            <span className="auth-help">
              Use 8+ characters with an uppercase letter, lowercase letter, number, and symbol.
            </span>
            <span className="auth-rules">
              <span>· 8+ length</span>
              <span>· Uppercase letter</span>
              <span>· Lowercase letter</span>
              <span>· Number</span>
              <span>· Symbol</span>
            </span>
          </label>
          <label className="auth-field">
            Confirm Password
            <span className="auth-password-wrap">
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
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
          <button type="submit">Create account</button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link href={loginHref}>Sign in</Link>
        </p>
      </section>
    </main>
  );
}
