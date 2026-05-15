import { AppShell } from "@/components/app-shell";
import { saveAiContextDocAction } from "@/app/ai-context-doc/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function AiContextDocPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const { data } = await supabase
    .from("ai_context_docs")
    .select("content, updated_at")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  return (
    <AppShell active="ai-context" tenantName={tenant.name}>
      <section className="page-header compact">
        <h1>AI Context Doc</h1>
        <p className="lede">Keep the context your assistant should remember about your business, offers, voice, goals, and constraints.</p>
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <form action={saveAiContextDocAction} className="wide-panel ai-context-form">
        <label>
          Context
          <textarea
            name="content"
            defaultValue={data?.content ?? ""}
            placeholder="Add business context, goals, offer details, audience notes, constraints, and preferences."
          />
        </label>
        <div className="header-row">
          <p className="muted">{data?.updated_at ? `Last saved ${new Date(data.updated_at).toLocaleString()}` : "Not saved yet"}</p>
          <button type="submit">Save</button>
        </div>
      </form>
    </AppShell>
  );
}
