import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (isAuthBypassEnabled()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <p className="eyebrow">HyperOptimal Metrics</p>
        <h1>Metrics that show what to fix next.</h1>
        <p className="lede">
          Sign in to view dashboards, connected channels, reports, and team access.
        </p>
        <div className="button-row">
          <Link href="/signup" className="button-primary">
            Create account
          </Link>
          <Link href="/login" className="button-secondary">
            Log in
          </Link>
        </div>
        <div className="link-row">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </section>
    </main>
  );
}
