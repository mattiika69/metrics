import { redirect } from "next/navigation";
import { updatePasswordAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";
import { requireUser } from "@/lib/auth/session";

export default async function ResetPasswordPage() {
  if (isAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  await requireUser();

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">HyperOptimal Metrics</p>
        <h1>Choose a new password</h1>
        <p className="lede">Use a strong password for your account.</p>
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
