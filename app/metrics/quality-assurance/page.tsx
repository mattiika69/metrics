import { AppShell, MetricsSubnav } from "@/components/app-shell";
import { saveQualityChecklistAction } from "@/app/metrics/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const checklistItems = [
  { id: "sales_calls", title: "Sales Calls", description: "Statuses, show/no-show, qualification, and close outcomes are current." },
  { id: "transactions_in", title: "Transactions In", description: "Revenue, recurring, and new-client revenue mappings are correct." },
  { id: "transactions_out", title: "Transactions Out", description: "Fixed, variable, fulfillment, acquisition, and waste flags are correct." },
  { id: "categories", title: "Categories", description: "Cost and revenue categories are aligned with metric formulas." },
  { id: "client_data", title: "Client Data", description: "Start, first payment, churn, and exclusion fields are correct." },
  { id: "client_payments", title: "Client Payments", description: "Payment rows match client status and timeline data." },
];

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getWeekStart() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function QualityAssurancePage({ searchParams }: PageProps) {
  const { supabase, tenant } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const weekStartDate = getWeekStart();
  const { data } = await supabase
    .from("metric_quality_checklists")
    .select("items, updated_at")
    .eq("tenant_id", tenant.id)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();
  const checked = new Set(
    Array.isArray(data?.items)
      ? data.items.filter((item: { completed?: boolean }) => item.completed).map((item: { id: string }) => item.id)
      : [],
  );

  return (
    <AppShell active="metrics" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">Metrics</p>
        <h1>Quality Assurance</h1>
        <p className="lede">Weekly checklist for keeping metric inputs aligned before decisions are made.</p>
        <MetricsSubnav active="quality-assurance" />
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <form action={saveQualityChecklistAction} className="wide-panel">
        <input type="hidden" name="weekStartDate" value={weekStartDate} />
        <div className="header-row">
          <div>
            <h2>Week of {weekStartDate}</h2>
            <p className="muted">{data?.updated_at ? `Last saved ${new Date(data.updated_at).toLocaleString()}` : "Not saved yet"}</p>
          </div>
          <button type="submit">Save checklist</button>
        </div>
        <div className="checklist">
          {checklistItems.map((item) => (
            <label className="check-row" key={item.id}>
              <input type="checkbox" name={item.id} defaultChecked={checked.has(item.id)} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </div>
      </form>
    </AppShell>
  );
}
