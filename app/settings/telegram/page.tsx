import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import { createTelegramLinkCodeAction } from "@/app/metrics/actions";
import { saveTelegramUsernameAction } from "@/app/settings/telegram/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function objectSettings(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function settingText(settings: Record<string, unknown>, key: string) {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

export default async function TelegramSettingsPage({ searchParams }: PageProps) {
  const { supabase, tenant, membership } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const error = param(params, "error");
  const code = param(params, "code");
  const expires = param(params, "expires");
  const { data: connections } = await supabase
    .from("tenant_integrations")
    .select("id, status, display_name, external_channel_id, external_user_id, settings, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("provider", "telegram")
    .order("updated_at", { ascending: false });
  const connection =
    connections?.find((row) => row.status !== "disabled" && row.external_channel_id) ??
    connections?.find((row) => row.status !== "disabled") ??
    connections?.[0] ??
    null;
  const settings = objectSettings(connection?.settings);
  const telegramUsername = settingText(settings, "telegramUsername");
  const botUsername = (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@+/, "").trim();
  const addGroupUrl = botUsername
    ? `https://t.me/${encodeURIComponent(botUsername)}?startgroup=link`
    : null;
  const openBotUrl = botUsername
    ? `https://t.me/${encodeURIComponent(botUsername)}`
    : null;
  const canManage = membership.role === "owner" || membership.role === "admin";
  const { data: channelLinks } = await supabase
    .from("integration_channel_links")
    .select("id, display_name, status, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("provider", "telegram")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <AppShell active="settings-telegram" tenantName={tenant.name}>
      <SettingsHeader title="Telegram" />
      <section className="settings-notices">
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>
      <SettingsTabs active="telegram" />

      <section className="settings-layout">
        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Username</p>
              <h2>Telegram recipient</h2>
            </div>
          </div>
          <form action={saveTelegramUsernameAction} className="form-stack compact">
            <label>
              Telegram username
              <input
                name="telegramUsername"
                placeholder="username"
                defaultValue={telegramUsername}
                autoComplete="off"
              />
            </label>
            <p className="muted">
              Save the username that should receive workspace messages.
            </p>
            <button type="submit">Save username</button>
          </form>
        </article>
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
              <strong>{channelLinks?.[0]?.display_name ?? connection?.display_name ?? "None"}</strong>
            </div>
            <div>
              <span>Access</span>
              <strong>{connection?.external_channel_id ? "Linked to this workspace" : "Not linked yet"}</strong>
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
          <p className="muted">
            Generate a short-lived code, then send /link CODE to the Telegram bot from the chat you want to connect.
          </p>
          <form action={createTelegramLinkCodeAction} className="card-action">
            <button type="submit" disabled={!canManage}>Generate link code</button>
          </form>
        </article>
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Groups</p>
              <h2>Add the bot</h2>
            </div>
          </div>
          <p className="muted">
            Add the bot to a Telegram group, generate a link code, then send /link CODE in that group.
          </p>
          <div className="settings-actions-row">
            {addGroupUrl ? (
              <a className="button-primary" href={addGroupUrl} target="_blank" rel="noreferrer">
                Add to group
              </a>
            ) : null}
            {openBotUrl ? (
              <a className="button-secondary" href={openBotUrl} target="_blank" rel="noreferrer">
                Open bot
              </a>
            ) : null}
          </div>
        </article>
        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Chats</p>
              <h2>Linked Telegram chats</h2>
            </div>
            <span className="pill">{channelLinks?.length ?? 0} linked</span>
          </div>
          <div className="settings-list">
            {channelLinks?.length ? (
              channelLinks.map((chat) => (
                <div key={chat.id}>
                  <span>{chat.display_name ?? "Telegram chat"}</span>
                  <strong>{chat.updated_at ? new Date(chat.updated_at).toLocaleString() : "Connected"}</strong>
                </div>
              ))
            ) : (
              <div>
                <span>Groups</span>
                <strong>Generate a link code, add the bot, then send /link CODE</strong>
              </div>
            )}
          </div>
        </article>
        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Agent</p>
              <h2>Available in Telegram</h2>
            </div>
          </div>
          <p className="muted">
            Use /help, /status, /metrics, /constraints, /forecast, /inputs, /sales, /retention, and /finance.
            You can also ask natural questions or say “remember...” to save useful context.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
