import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";
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
  if (isAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">HyperOptimal Metrics</p>
        <h1>Reset password</h1>
        <p className="lede">Send a secure reset link to your email.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <form action={forgotPasswordAction} className="form-stack">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button type="submit">Send reset link</button>
        </form>
        <div className="link-row">
          <Link href="/login">Back to login</Link>
        </div>
      </section>
    </main>
  );
}
