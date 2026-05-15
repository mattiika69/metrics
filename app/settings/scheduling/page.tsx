import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import {
  archiveScheduleAction,
  createScheduleAction,
  runScheduleNowAction,
  toggleScheduleAction,
} from "@/lib/integrations/scheduling-actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function canManage(role: string) {
  return role === "owner" || role === "admin";
}

export default async function SchedulingSettingsPage({ searchParams }: PageProps) {
  const { supabase, tenant, membership } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const error = param(params, "error");
  const isAdmin = canManage(membership.role);
  const [{ data: schedules }, { data: runs }, { data: channels }] = await Promise.all([
    supabase
      .from("integration_workflow_schedules")
      .select("id, name, workflow_key, target_providers, cadence, timezone, enabled, archived_at, slack_channel_id, telegram_chat_id, created_at")
      .eq("tenant_id", tenant.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("integration_workflow_runs")
      .select("id, schedule_id, status, target_provider, started_at, finished_at, error_message, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("tenant_integrations")
      .select("provider, external_channel_id, display_name, status")
      .eq("tenant_id", tenant.id)
      .neq("status", "disabled"),
  ]);
  const slackChannels = (channels ?? []).filter((channel) => channel.provider === "slack");
  const telegramChats = (channels ?? []).filter((channel) => channel.provider === "telegram");

  return (
    <AppShell active="settings" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Settings</h1>
        <p className="lede">Schedule reports and operating prompts for connected channels.</p>
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>
      <SettingsTabs active="scheduling" />
      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Schedules</p>
              <h2>Active workflows</h2>
            </div>
            <span className="pill">{schedules?.length ?? 0} active</span>
          </div>
          <div className="table-list">
            {schedules?.length ? (
              schedules.map((schedule) => (
                <div className="table-row" key={schedule.id}>
                  <div>
                    <strong>{schedule.name}</strong>
                    <span className="muted">
                      {schedule.workflow_key.replaceAll("_", " ")} · {schedule.cadence} · {schedule.timezone}
                    </span>
                  </div>
                  <div className="row-actions">
                    <span className="pill">{schedule.enabled ? "On" : "Paused"}</span>
                    {isAdmin ? (
                      <>
                        <form action={runScheduleNowAction}>
                          <input type="hidden" name="scheduleId" value={schedule.id} />
                          <button type="submit" className="button-secondary">Run now</button>
                        </form>
                        <form action={toggleScheduleAction}>
                          <input type="hidden" name="scheduleId" value={schedule.id} />
                          <input type="hidden" name="enabled" value={schedule.enabled ? "false" : "true"} />
                          <button type="submit" className="button-secondary">
                            {schedule.enabled ? "Pause" : "Enable"}
                          </button>
                        </form>
                        <form action={archiveScheduleAction}>
                          <input type="hidden" name="scheduleId" value={schedule.id} />
                          <button type="submit" className="button-secondary">Archive</button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No schedules yet.</p>
            )}
          </div>
        </article>
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Create</p>
              <h2>New schedule</h2>
            </div>
          </div>
          {isAdmin ? (
            <form action={createScheduleAction} className="form-stack compact">
              <label>
                Name
                <input name="name" placeholder="Weekly CEO report" required />
              </label>
              <label>
                Workflow
                <select name="workflowKey" defaultValue="metrics_report">
                  <option value="metrics_report">Metrics report</option>
                  <option value="constraints_report">Constraints report</option>
                  <option value="forecast_report">Forecast report</option>
                  <option value="department_report">Department report</option>
                </select>
              </label>
              <label>
                Cadence
                <select name="cadence" defaultValue="weekly">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label>
                Timezone
                <input name="timezone" defaultValue="America/New_York" />
              </label>
              <fieldset className="metric-selector-group">
                <legend>Targets</legend>
                <label className="metric-checkbox-row">
                  <input name="targetProviders" type="checkbox" value="slack" />
                  Slack
                </label>
                <label className="metric-checkbox-row">
                  <input name="targetProviders" type="checkbox" value="telegram" />
                  Telegram
                </label>
              </fieldset>
              <label>
                Slack channel
                <select name="slackChannelId" defaultValue="">
                  <option value="">Choose when connected</option>
                  {slackChannels.map((channel) => (
                    <option value={channel.external_channel_id ?? ""} key={channel.external_channel_id}>
                      {channel.display_name ?? channel.external_channel_id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Telegram chat
                <select name="telegramChatId" defaultValue="">
                  <option value="">Choose when connected</option>
                  {telegramChats.map((channel) => (
                    <option value={channel.external_channel_id ?? ""} key={channel.external_channel_id}>
                      {channel.display_name ?? channel.external_channel_id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Message
                <input name="messageTemplate" placeholder="Send the latest metrics." />
              </label>
              <button type="submit">Create schedule</button>
            </form>
          ) : (
            <p className="muted">Only workspace admins can create schedules.</p>
          )}
        </article>
        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">History</p>
              <h2>Recent runs</h2>
            </div>
          </div>
          <div className="table-list">
            {runs?.length ? (
              runs.map((run) => (
                <div className="table-row" key={run.id}>
                  <div>
                    <strong>{run.status}</strong>
                    <span className="muted">
                      {run.target_provider ?? "Workflow"} · {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="muted">
                    {run.finished_at ? new Date(run.finished_at).toLocaleTimeString() : "In progress"}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No runs recorded yet.</p>
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
