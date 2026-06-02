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
  const { supabase, tenant, membership } = await requireTenant();
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
  const { data: channelLinks } = await supabase
    .from("integration_channel_links")
    .select("id, display_name, status, metadata, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("provider", "slack")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(5);
  const canManage = membership.role === "owner" || membership.role === "admin";

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
              <strong>{channelLinks?.[0]?.display_name ?? (connection?.external_channel_id ? "Connected" : "Not selected yet")}</strong>
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
            Connect Slack, invite the bot to a public or private channel, then mention it once or use /agent from that channel.
          </p>
          <Link
            href="/api/integrations/slack/oauth/start"
            className={`button-primary card-action${canManage ? "" : " disabled-link"}`}
            aria-disabled={!canManage}
          >
            Connect Slack
          </Link>
        </article>
        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Channels</p>
              <h2>Linked Slack channels</h2>
            </div>
            <span className="pill">{channelLinks?.length ?? 0} linked</span>
          </div>
          <div className="settings-list">
            {channelLinks?.length ? (
              channelLinks.map((channel) => (
                <div key={channel.id}>
                  <span>{channel.display_name ?? "Slack channel"}</span>
                  <strong>{channel.updated_at ? new Date(channel.updated_at).toLocaleString() : "Connected"}</strong>
                </div>
              ))
            ) : (
              <div>
                <span>Private channels</span>
                <strong>Invite the bot, then mention it or use /agent once</strong>
              </div>
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
