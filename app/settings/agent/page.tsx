import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function canManageAgent(role: string) {
  return role === "owner" || role === "admin";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default async function AgentSettingsPage() {
  const { supabase, tenant, membership } = await requireTenant();
  const canManage = canManageAgent(membership.role);
  const { data: requests } = await supabase
    .from("agent_requests")
    .select("id, request_text, status, risk_level, provider, created_at, updated_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <AppShell active="settings-agent" tenantName={tenant.name}>
      <SettingsHeader title="Agent" />
      <SettingsTabs active="agent" />

      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Agent</p>
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
              <span>Slack and Telegram</span>
              <strong>Uses connected channels</strong>
            </div>
            <div>
              <span>Context</span>
              <strong>AI Context Document</strong>
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
            Agent requests are saved before work begins and are reviewed against workspace access.
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
              <p className="step-label">Recent</p>
              <h2>Agent requests</h2>
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
                      {request.provider ?? "web"} · {request.risk_level} · {formatDate(request.created_at)}
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
