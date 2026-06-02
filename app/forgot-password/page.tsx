import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth/submit-button";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { authRedirectParam, appendAuthRedirect, readAuthRedirectParam } from "@/lib/auth/redirects";

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

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const email = getParam(params, "email") ?? "";
  const next = readAuthRedirectParam(params, "/dashboard");
  const signInHref = (() => {
    const base = appendAuthRedirect("/login", next, "/dashboard");
    const separator = base.includes("?") ? "&" : "?";
    return email ? `${base}${separator}email=${encodeURIComponent(email)}` : base;
  })();

  if (message) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-success-icon" aria-hidden="true">✉</div>
          <div className="auth-heading">
            <h1>Check your email</h1>
            <p>
              If an account exists for {email || "that email"}, we&apos;ve sent a
              password reset link. Click the link to continue.
            </p>
          </div>
          <Link href={signInHref} className="auth-link-button">
            Back to Sign In
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-heading">
          <h1>ScalingMetrics</h1>
          <p>Reset your password</p>
        </div>
        <p className="auth-copy">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
        {error ? <p className="notice error">{error}</p> : null}
        <form action={forgotPasswordAction} className="auth-form">
          <input type="hidden" name={authRedirectParam} value={next} />
          <label className="auth-field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={email}
              placeholder="you@example.com"
              required
            />
          </label>
          <AuthSubmitButton pendingText="Sending...">
            Send reset link
          </AuthSubmitButton>
        </form>
        <p className="auth-switch">
          Remember your password? <Link href={signInHref}>Sign in</Link>
        </p>
      </section>
    </main>
  );
}
