import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ScheduleRow = {
  id: string;
  name: string;
  workflow_key: string;
  cadence: string;
  timezone: string;
  target_providers: string[] | null;
  enabled: boolean;
};

type RunRow = {
  id: string;
  schedule_id: string | null;
  status: string;
  target_provider: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
  output_metadata: Record<string, unknown> | null;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayDate();
}

function nextDate(value: string, direction: -1 | 1) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + direction);
  return date.toISOString().slice(0, 10);
}

function dateBounds(value: string) {
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function workflowLabel(value: string) {
  return value.replaceAll("_", " ");
}

function providerLabel(schedule: ScheduleRow) {
  const providers = schedule.target_providers?.filter(Boolean) ?? [];
  if (providers.length) return "Delivery configured";
  return "No delivery target";
}

function scheduleForRun(run: RunRow, schedules: ScheduleRow[]) {
  return schedules.find((schedule) => schedule.id === run.schedule_id);
}

export default async function DailySchedulePage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const selectedDate = normalizeDate(param(params, "date"));
  const { start, end } = dateBounds(selectedDate);

  const [{ data: schedules }, { data: runs }] = await Promise.all([
    supabase
      .from("integration_workflow_schedules")
      .select("id, name, workflow_key, cadence, timezone, target_providers, enabled")
      .eq("tenant_id", tenant.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("integration_workflow_runs")
      .select("id, schedule_id, status, target_provider, started_at, finished_at, error_message, created_at, output_metadata")
      .eq("tenant_id", tenant.id)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true }),
  ]);

  const activeSchedules = (schedules ?? []) as ScheduleRow[];
  const dailyRuns = (runs ?? []) as RunRow[];
  const previousDate = nextDate(selectedDate, -1);
  const followingDate = nextDate(selectedDate, 1);

  return (
    <AppShell active="settings-scheduling" tenantName={tenant.name}>
      <SettingsHeader title="Daily Schedule" />
      <SettingsTabs active="scheduling" />
      <section className="daily-schedule-shell">
        <div className="daily-schedule-header">
          <div>
            <p className="step-label">Schedule date</p>
            <h2>{displayDate(selectedDate)}</h2>
          </div>
          <form className="schedule-date-form" action="/settings/scheduling/daily">
            <label>
              Date
              <input type="date" name="date" defaultValue={selectedDate} />
            </label>
            <button type="submit" className="button-secondary">Open</button>
          </form>
        </div>
        <div className="daily-schedule-nav">
          <Link className="button-secondary" href={`/settings/scheduling/daily?date=${previousDate}`}>
            Previous day
          </Link>
          <Link className="button-secondary" href="/settings/scheduling/daily">
            Today
          </Link>
          <Link className="button-secondary" href={`/settings/scheduling/daily?date=${followingDate}`}>
            Next day
          </Link>
        </div>
      </section>

      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Due</p>
              <h2>Scheduled workflows</h2>
            </div>
            <span className="pill">{activeSchedules.length}</span>
          </div>
          <div className="table-list">
            {activeSchedules.length ? (
              activeSchedules.map((schedule) => (
                <div className="table-row" key={schedule.id}>
                  <div>
                    <strong>{schedule.name}</strong>
                    <span className="muted">
                      {workflowLabel(schedule.workflow_key)} · {schedule.cadence} · {schedule.timezone}
                    </span>
                  </div>
                  <div className="row-actions">
                    <span className="pill">{schedule.enabled ? "On" : "Paused"}</span>
                    <span className="muted">{providerLabel(schedule)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No scheduled workflows.</p>
            )}
          </div>
        </article>

        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Completed</p>
              <h2>Runs for this date</h2>
            </div>
            <span className="pill">{dailyRuns.length}</span>
          </div>
          <div className="table-list">
            {dailyRuns.length ? (
              dailyRuns.map((run) => {
                const schedule = scheduleForRun(run, activeSchedules);
                return (
                  <div className="table-row" key={run.id}>
                    <div>
                      <strong>{schedule?.name ?? run.target_provider ?? "Workflow"}</strong>
                      <span className="muted">
                        {run.status} · {new Date(run.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="row-actions">
                      <span className="pill">{run.target_provider ?? "Workflow"}</span>
                      <span className="muted">
                        {run.finished_at ? new Date(run.finished_at).toLocaleTimeString() : "In progress"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted">No runs recorded for this date.</p>
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
