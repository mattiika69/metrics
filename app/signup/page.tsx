import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/submit-button";
import { signUpAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";
import { authRedirectParam, readAuthRedirectParam } from "@/lib/auth/redirects";

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
  const next = readAuthRedirectParam(params, "/get-started");

  if (isAuthBypassEnabled() && !isInviteNext(next)) {
    redirect("/dashboard");
  }

  const email = getParam(params, "email") ?? "";
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const success = getParam(params, "success") === "1";
  const isInviteFlow = Boolean(next?.startsWith("/settings/team/accept"));
  const loginParams = new URLSearchParams();
  if (next !== "/get-started") loginParams.set(authRedirectParam, next);
  if (email) loginParams.set("email", email);
  const loginQuery = loginParams.toString();
  const loginHref = loginQuery ? `/login?${loginQuery}` : "/login";

  if (success) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-success-icon ok" aria-hidden="true">✓</div>
          <div className="auth-heading">
            <h1>Check your email</h1>
            <p>
              We&apos;ve sent a confirmation link to {email || "your email"}.
              Please click the link to continue setup.
            </p>
          </div>
          <Link href={loginHref} className="auth-link-button">
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
          <p>
            {isInviteFlow
              ? "Create your account to join the workspace"
              : "Create your account"}
          </p>
        </div>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        <form action={signUpAction} className="auth-form">
          <input type="hidden" name={authRedirectParam} value={next} />
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
          <PasswordField
            name="password"
            label="Password"
            autoComplete="new-password"
            minLength={8}
            helper="Use 8+ characters with an uppercase letter, lowercase letter, number, and symbol."
          />
          <span className="auth-rules">
            <span>· 8+ length</span>
            <span>· Uppercase letter</span>
            <span>· Lowercase letter</span>
            <span>· Number</span>
            <span>· Symbol</span>
          </span>
          <PasswordField
            name="confirmPassword"
            label="Confirm Password"
            autoComplete="new-password"
          />
          <AuthSubmitButton pendingText="Creating account...">
            Create account
          </AuthSubmitButton>
        </form>
        <p className="auth-switch">
          Already have an account? <Link href={loginHref}>Sign in</Link>
        </p>
      </section>
    </main>
  );
}
