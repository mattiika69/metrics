import { AppShell } from "@/components/app-shell";
import { createLearningAction, deleteLearningAction, updateLearningAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type LearningRow = {
  id: string;
  title: string;
  source: string;
  body: string;
  updated_at: string;
};

const learningSources = [
  "General",
  "Marketing",
  "Sales",
  "Retention",
  "Finance",
  "Benchmarks",
  "Constraints",
  "Slack",
  "Telegram",
];

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function SourceSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="source" defaultValue={defaultValue ?? "General"} aria-label="Source">
      {learningSources.map((source) => (
        <option key={source} value={source}>{source}</option>
      ))}
    </select>
  );
}

export default async function LearningsPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const error = param(params, "error");
  const { data } = await supabase
    .from("metric_learnings")
    .select("id, title, source, body, updated_at")
    .eq("tenant_id", tenant.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  const learnings = (data ?? []) as LearningRow[];

  return (
    <AppShell active="learnings" tenantName={tenant.name}>
      <section className="scaling-page">
        <header className="scaling-header">
          <div>
            <h1>Learnings</h1>
            <p>MEMBER SINCE MARCH 2026</p>
          </div>
        </header>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}

        <div className="learnings-layout">
          <form action={createLearningAction} className="learning-panel learning-form">
            <h2>Add Learning</h2>
            <SourceSelect />
            <input name="title" placeholder="Learning title" />
            <textarea name="body" placeholder="What should the app remember?" />
            <button type="submit">Save Learning</button>
          </form>

          <section className="learning-panel learning-list-panel">
            <h2>Saved Learnings</h2>
            {learnings.length === 0 ? (
              <div className="learning-empty">No learnings yet.</div>
            ) : (
              <div className="learning-list">
                {learnings.map((learning) => (
                  <article className="learning-item" key={learning.id}>
                    <form action={updateLearningAction}>
                      <input type="hidden" name="id" value={learning.id} />
                      <div className="learning-item-row">
                        <input name="title" defaultValue={learning.title} aria-label="Learning title" />
                        <SourceSelect defaultValue={learning.source} />
                      </div>
                      <textarea name="body" defaultValue={learning.body} aria-label="Learning" />
                      <div className="learning-actions">
                        <span>Saved {new Date(learning.updated_at).toLocaleDateString()}</span>
                        <button type="submit">Save</button>
                      </div>
                    </form>
                    <form action={deleteLearningAction}>
                      <input type="hidden" name="id" value={learning.id} />
                      <button type="submit" className="text-danger">Delete</button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </AppShell>
  );
}
