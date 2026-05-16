import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { createTelegramLinkCodeAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function TelegramSettingsPage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const error = param(params, "error");
  const code = param(params, "code");
  const expires = param(params, "expires");
  const { data: connection } = await supabase
    .from("tenant_integrations")
    .select("id, status, display_name, external_channel_id, external_user_id, settings, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("provider", "telegram")
    .neq("status", "disabled")
    .maybeSingle();

  return (
    <AppShell active="settings-telegram" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Settings</h1>
        <p className="lede">Connect Telegram for workspace metrics, constraints, and forecast commands.</p>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>
      <SettingsTabs active="telegram" />

      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Telegram</p>
              <h2>Connection</h2>
            </div>
            <span className="pill">{connection?.status ?? "Not connected"}</span>
          </div>
          <div className="settings-list">
            <div>
              <span>Chat</span>
              <strong>{connection?.display_name ?? "None"}</strong>
            </div>
            <div>
              <span>Chat ID</span>
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
              <p className="step-label">Link Code</p>
              <h2>Connect chat</h2>
            </div>
          </div>
          {code ? (
            <p className="notice">
              Code: <strong>{code}</strong>
              {expires ? ` | expires ${new Date(expires).toLocaleString()}` : null}
            </p>
          ) : null}
          <p className="muted">Generate a code, then send /link CODE to the Telegram bot.</p>
          <form action={createTelegramLinkCodeAction} className="card-action">
            <button type="submit">Generate link code</button>
          </form>
        </article>
        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Commands</p>
              <h2>Available in Telegram</h2>
            </div>
          </div>
          <p className="muted">Use /metrics, /constraints, /forecast, /inputs, /sales, /retention, and /finance.</p>
        </article>
      </section>
    </AppShell>
  );
}
