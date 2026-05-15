import Link from "next/link";
import { forgotPasswordAction } from "@/lib/auth/actions";

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

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-heading">
          <h1>HyperOptimal</h1>
          <p>Reset your password</p>
        </div>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <p className="auth-copy">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
        <form action={forgotPasswordAction} className="auth-form">
          <label className="auth-field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <button type="submit">Send reset link</button>
        </form>
        <p className="auth-switch">
          Remember your password? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
