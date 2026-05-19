import Link from "next/link";
import { PasswordField } from "@/components/auth/password-field";
import { AuthSubmitButton } from "@/components/auth/submit-button";
import { updatePasswordAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-heading">
            <h1>HyperOptimal</h1>
            <p>Reset your password</p>
          </div>
          <p className="notice error">
            Use the link from your reset email to set a new password.
          </p>
          <Link href="/forgot-password" className="auth-link-button">
            Request a new link
          </Link>
        </section>
      </main>
    );
  }

  const params = await searchParams;
  const error = getParam(params, "error");
  const message = getParam(params, "message");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-heading">
          <h1>HyperOptimal</h1>
          <p>Set your new password</p>
        </div>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        <form action={updatePasswordAction} className="auth-form">
          <PasswordField
            name="password"
            label="New Password"
            autoComplete="new-password"
            minLength={8}
            helper="Use 8+ characters with upper/lowercase, a number, and a symbol."
          />
          <PasswordField
            name="confirmPassword"
            label="Confirm New Password"
            autoComplete="new-password"
          />
          <AuthSubmitButton pendingText="Updating...">
            Update password
          </AuthSubmitButton>
        </form>
      </section>
    </main>
  );
}
