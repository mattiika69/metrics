import { updatePasswordAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

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

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  await requireUser();
  const params = await searchParams;
  const error = getParam(params, "error");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">HyperOptimal Metrics</p>
        <h1>Choose a new password</h1>
        <p className="lede">Use a strong password for your account.</p>
        {error ? <p className="notice error">{error}</p> : null}
        <form action={updatePasswordAction} className="form-stack">
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button type="submit">Update password</button>
        </form>
      </section>
    </main>
  );
}
