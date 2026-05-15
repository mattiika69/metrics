import { AppShell } from "@/components/app-shell";
import { createMetricPrincipleAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function MetricPrinciplesPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const { data: principles } = await supabase
    .from("metric_principles")
    .select("id, title, description, video_url, display_order, active, created_at")
    .eq("tenant_id", tenant.id)
    .order("display_order", { ascending: true });

  return (
    <AppShell active="metrics-principles" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">Metrics</p>
        <h1>Principles</h1>
        <p className="lede">Shared rules for reading and improving your metrics.</p>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section className="split-layout">
        <div className="wide-panel">
          <h2>Saved Principles</h2>
          {principles?.length ? (
            <div className="stack">
              {principles.map((principle) => (
                <article className="compact-card" key={principle.id}>
                  <h2>{principle.title}</h2>
                  <p>{principle.description}</p>
                  {principle.video_url ? <a href={principle.video_url}>Video</a> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">No principles yet. Add the first one to make metric interpretation explicit.</p>
          )}
        </div>

        <aside className="compact-card">
          <h2>Add Principle</h2>
          <form action={createMetricPrincipleAction} className="form-stack compact">
            <label>
              Title
              <input name="title" required />
            </label>
            <label>
              Description
              <input name="description" required />
            </label>
            <label>
              Video URL
              <input name="videoUrl" type="url" />
            </label>
            <button type="submit">Save principle</button>
          </form>
        </aside>
      </section>
    </AppShell>
  );
}
