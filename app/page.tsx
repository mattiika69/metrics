import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (hasSupabaseEnv) {
    const supabase = await createClient();
    await supabase.from("_health").select("*").limit(1);
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <p className="eyebrow">Metrics</p>
        <h1>Vercel and Supabase are wired in.</h1>
        <p className="lede">
          This Next.js app is ready for dashboard work, with Supabase clients
          configured for server and browser usage.
        </p>
        <div className="status-row">
          <span className={hasSupabaseEnv ? "status ok" : "status warn"} />
          <span>
            {hasSupabaseEnv
              ? "Supabase environment variables are present."
              : "Add Supabase environment variables to finish setup."}
          </span>
        </div>
      </section>
    </main>
  );
}
