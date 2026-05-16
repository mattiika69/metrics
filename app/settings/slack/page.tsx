import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { requireTenant } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function SlackSettingsPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message") ?? (param(params, "connected") ? "Slack connected" : null);
  const error = param(params, "error");
  const { data: connection } = await supabase
    .from("tenant_integrations")
    .select("id, status, display_name, external_team_id, external_channel_id, settings, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("provider", "slack")
    .neq("status", "disabled")
    .maybeSingle();

  return (
    <AppShell active="settings-slack" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Settings</h1>
        <p className="lede">Connect Slack for workspace metrics, constraints, and forecast commands.</p>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>
      <SettingsTabs active="slack" />

      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Slack</p>
              <h2>Connection</h2>
            </div>
            <span className="pill">{connection?.status ?? "Not connected"}</span>
          </div>
          <div className="settings-list">
            <div>
              <span>Workspace</span>
              <strong>{connection?.display_name ?? "None"}</strong>
            </div>
            <div>
              <span>Team ID</span>
              <strong>{connection?.external_team_id ?? "None"}</strong>
            </div>
            <div>
              <span>Default channel</span>
              <strong>{connection?.external_channel_id ?? "None"}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{connection?.updated_at ? new Date(connection.updated_at).toLocaleString() : "Never"}</strong>
            </div>
          </div>
        </article>
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Commands</p>
              <h2>Available in Slack</h2>
            </div>
          </div>
          <p className="muted">Use /metrics, /constraints, /forecast, /inputs, /sales, /retention, and /finance.</p>
          <Link href="/api/integrations/slack/oauth/start" className="button-primary card-action">
            Connect Slack
          </Link>
        </article>
      </section>
    </AppShell>
  );
}
