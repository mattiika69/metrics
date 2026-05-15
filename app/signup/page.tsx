import Link from "next/link";
import { signUpAction } from "@/lib/auth/actions";

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

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = getParam(params, "error");
  const next = getParam(params, "next");
  const loginHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">HyperOptimal Metrics</p>
        <h1>Create account</h1>
        <p className="lede">
          Start with a secure account, then create your workspace.
        </p>
        {error ? <p className="notice error">{error}</p> : null}
        <form action={signUpAction} className="form-stack">
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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button type="submit">Create account</button>
        </form>
        <div className="link-row">
          <Link href={loginHref}>Already have an account?</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </section>
    </main>
  );
}
