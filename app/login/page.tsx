import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/submit-button";
import { signInAction } from "@/lib/auth/actions";
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

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = readAuthRedirectParam(params, "/dashboard");

  if (isAuthBypassEnabled() && !isInviteNext(next)) {
    redirect("/dashboard");
  }

  const email = getParam(params, "email") ?? "";
  const error = getParam(params, "error");
  const message = getParam(params, "message");
  const signupParams = new URLSearchParams();
  if (next !== "/dashboard") signupParams.set(authRedirectParam, next);
  if (email) signupParams.set("email", email);
  const signupQuery = signupParams.toString();
  const signupHref = signupQuery ? `/signup?${signupQuery}` : "/signup";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-heading">
          <h1>HyperOptimal</h1>
          <p>Sign in to your account</p>
        </div>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        <form action={signInAction} className="auth-form">
          <input type="hidden" name={authRedirectParam} value={next} />
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
            autoComplete="current-password"
            action={<Link href="/forgot-password">Forgot password?</Link>}
          />
          <AuthSubmitButton pendingText="Signing in...">Sign in</AuthSubmitButton>
        </form>
        <p className="auth-switch">
          Don&apos;t have an account? <Link href={signupHref}>Sign up</Link>
        </p>
      </section>
    </main>
  );
}
