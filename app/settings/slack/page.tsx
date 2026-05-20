import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

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
    .select("id, status, display_name, external_channel_id, settings, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("provider", "slack")
    .neq("status", "disabled")
    .maybeSingle();

  return (
    <AppShell active="settings-slack" tenantName={tenant.name}>
      <SettingsHeader title="Slack" />
      <section className="settings-notices">
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
              <span>Approved channel</span>
              <strong>{connection?.external_channel_id ? "Connected" : "Not selected yet"}</strong>
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
              <p className="step-label">Agent</p>
              <h2>Available in Slack</h2>
            </div>
          </div>
          <p className="muted">
            Use /help, /status, /metrics, /constraints, /forecast, /inputs, /sales, /retention, and /finance.
            You can also ask natural questions or say “remember...” to save useful context.
          </p>
          <p className="muted">
            Connect Slack from this app. The first Slack channel that uses the bot becomes the approved channel for this workspace.
          </p>
          <Link href="/api/integrations/slack/oauth/start" className="button-primary card-action">
            Connect Slack
          </Link>
        </article>
      </section>
    </AppShell>
  );
}
