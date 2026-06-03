import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import Link from "next/link";
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

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayDate();
}

function runDate(value: string | null | undefined, fallback: string) {
  return value?.slice(0, 10) ?? fallback;
}

export default async function SchedulingSettingsPage({ searchParams }: PageProps) {
  const { supabase, tenant, membership } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const error = param(params, "error");
  const selectedDate = normalizeDate(param(params, "date"));
  const isAdmin = canManage(membership.role);
  const [{ data: schedules }, { data: runs }] = await Promise.all([
    supabase
      .from("integration_workflow_schedules")
      .select("id, name, workflow_key, target_providers, cadence, timezone, enabled, archived_at, created_at")
      .eq("tenant_id", tenant.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("integration_workflow_runs")
      .select("id, schedule_id, status, target_provider, started_at, finished_at, error_message, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <AppShell active="settings-scheduling" tenantName={tenant.name}>
      <SettingsHeader title="Scheduling" />
      <section className="settings-notices">
        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>
      <SettingsTabs active="scheduling" />
      <section className="schedule-date-bar">
        <form className="schedule-date-form" action="/settings/scheduling/daily">
          <label>
            Daily schedule
            <input type="date" name="date" defaultValue={selectedDate} />
          </label>
          <button type="submit" className="button-secondary">Open date</button>
        </form>
        <Link className="button-secondary" href={`/settings/scheduling/daily?date=${selectedDate}`}>
          View daily schedule
        </Link>
      </section>
      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Schedules</p>
              <h2>Scheduled reports</h2>
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
                    <Link className="button-secondary" href={`/settings/scheduling/daily?date=${selectedDate}`}>
                      Open date
                    </Link>
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
              <input type="hidden" name="targetProviders" value="workspace" />
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
              <label>
                Message
                <input name="messageTemplate" placeholder="Send the latest metrics." />
              </label>
              <button type="submit">Create schedule</button>
            </form>
          ) : (
            <p className="muted">Only admins can create schedules.</p>
          )}
        </article>
        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">History</p>
              <h2>Recent activity</h2>
            </div>
          </div>
          <div className="table-list">
            {runs?.length ? (
              runs.map((run) => (
                <Link
                  className="table-row schedule-run-link"
                  href={`/settings/scheduling/daily?date=${runDate(run.started_at ?? run.created_at, selectedDate)}`}
                  key={run.id}
                >
                  <div>
                    <strong>{run.status}</strong>
                    <span className="muted">
                      Workflow · {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="muted">
                    {run.finished_at ? new Date(run.finished_at).toLocaleTimeString() : "In progress"}
                  </span>
                </Link>
              ))
            ) : (
              <p className="muted">No activity yet.</p>
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
