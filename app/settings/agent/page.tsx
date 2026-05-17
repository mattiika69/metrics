import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import { createWebAgentRequestAction } from "@/app/settings/agent/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function canManageAgent(role: string) {
  return role === "owner" || role === "admin";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function requestOperation(metadata: unknown, fallback: string) {
  if (metadata && typeof metadata === "object" && "operation" in metadata) {
    const operation = (metadata as { operation?: unknown }).operation;
    if (typeof operation === "string" && operation) return operation;
  }

  return fallback;
}

export default async function AgentSettingsPage({ searchParams }: PageProps) {
  const { supabase, tenant, membership } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const error = param(params, "error");
  const canManage = canManageAgent(membership.role);
  const { data: requests } = await supabase
    .from("agent_requests")
    .select("id, request_text, status, risk_level, provider, metadata, created_at, updated_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <AppShell active="settings-agent" tenantName={tenant.name}>
      <SettingsHeader title="AI Agent" />
      <section className="settings-notices">
        {message ? <p className="notice">AI Agent request saved.</p> : null}
        {error ? <p className="notice error">{error.replaceAll("_", " ")}</p> : null}
      </section>
      <SettingsTabs active="agent" />

      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">AI Agent</p>
              <h2>Workspace access</h2>
            </div>
            <span className="pill">{canManage ? "Enabled" : "View only"}</span>
          </div>
          <div className="settings-list">
            <div>
              <span>Access</span>
              <strong>{canManage ? "Owners and admins" : "Owner or admin required"}</strong>
            </div>
            <div>
              <span>Access from</span>
              <strong>App, Slack, Telegram</strong>
            </div>
            <div>
              <span>Capabilities</span>
              <strong>Read, write, edit</strong>
            </div>
          </div>
        </article>

        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Controls</p>
              <h2>Request handling</h2>
            </div>
          </div>
          <p className="muted">
            AI Agent requests can start from the app, Slack, or Telegram. Every request is saved first.
          </p>
          <div className="settings-list">
            <div>
              <span>Changes</span>
              <strong>Require approval</strong>
            </div>
            <div>
              <span>Activity</span>
              <strong>Saved to the workspace</strong>
            </div>
          </div>
        </article>

        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Request</p>
              <h2>Ask the AI Agent</h2>
            </div>
            <span className="pill">App</span>
          </div>
          <form action={createWebAgentRequestAction} className="agent-request-form">
            <label>
              <span>Mode</span>
              <select name="operation" defaultValue="operate" disabled={!canManage}>
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="edit">Edit</option>
                <option value="operate">Auto</option>
              </select>
            </label>
            <label>
              <span>Request</span>
              <textarea
                name="requestText"
                rows={4}
                placeholder="Ask the AI Agent to read, write, or edit something in the workspace."
                disabled={!canManage}
                required
              />
            </label>
            <button type="submit" disabled={!canManage}>
              Save request
            </button>
          </form>
        </article>

        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Recent</p>
              <h2>AI Agent requests</h2>
            </div>
            <span className="pill">{requests?.length ?? 0} shown</span>
          </div>
          <div className="table-list">
            {requests?.length ? (
              requests.map((request) => (
                <div className="table-row" key={request.id}>
                  <div>
                    <strong>{request.request_text}</strong>
                    <span className="muted">
                      {request.provider ?? "web"} · {requestOperation(request.metadata, request.risk_level)} · {formatDate(request.created_at)}
                    </span>
                  </div>
                  <span className="pill">{request.status}</span>
                </div>
              ))
            ) : (
              <p className="muted">No agent requests yet.</p>
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
