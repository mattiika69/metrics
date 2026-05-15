import Link from "next/link";
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
  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">HyperOptimal Metrics</p>
        <h1>Log in</h1>
        <p className="lede">Access your workspace, reports, and admin tools.</p>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <form action={signInAction} className="form-stack">
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
          <Link href="/signup">Create account</Link>
        </div>
      </section>
    </main>
  );
}
