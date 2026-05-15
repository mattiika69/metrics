import { createAdminClient } from "@/lib/supabase/admin";
import { computeMetrics, type MetricSnapshotValue } from "@/lib/metrics/compute";
import { metricDefinitions } from "@/lib/metrics/definitions";
import { resolvePeriod, type PeriodKey } from "@/lib/metrics/period";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

export type MetricSnapshotPayload = {
  window: ReturnType<typeof resolvePeriod>;
  definitions: typeof metricDefinitions;
  metrics: Record<string, MetricSnapshotValue>;
  calculatedAt: string | null;
};

export function periodFromSearch(value: string | null | undefined): PeriodKey {
  const allowed = new Set(["today", "7d", "30d", "90d", "mtd", "qtd", "ytd", "all"]);
  return value && allowed.has(value) ? (value as PeriodKey) : "30d";
}

function emptyMetricMap(): Record<string, MetricSnapshotValue> {
  return Object.fromEntries(
    metricDefinitions.map((definition) => [
      definition.id,
      {
        metric_id: definition.id,
        value: null,
        raw_inputs: {},
        sources: { empty: true },
      } satisfies MetricSnapshotValue,
    ]),
  );
}

export async function loadMetricSnapshotPayload({
  supabase,
  tenantId,
  periodKey = "30d",
}: {
  supabase: SupabaseLike;
  tenantId: string;
  periodKey?: PeriodKey;
}): Promise<MetricSnapshotPayload> {
  const window = resolvePeriod(periodKey);
  const metrics = emptyMetricMap();

  const { data: snapshots } = await supabase
    .from("metric_snapshots")
    .select("metric_id, value, raw_inputs, sources, calculated_at")
    .eq("tenant_id", tenantId)
    .eq("period_key", window.key)
    .eq("period_start", window.startDate)
    .eq("period_end", window.endDate);

  let calculatedAt: string | null = null;

  for (const snapshot of snapshots ?? []) {
    const value = typeof snapshot.value === "number"
      ? snapshot.value
      : snapshot.value === null
        ? null
        : Number(snapshot.value);
    metrics[snapshot.metric_id] = {
      metric_id: snapshot.metric_id,
      value: Number.isFinite(value) ? value : null,
      raw_inputs: snapshot.raw_inputs ?? {},
      sources: snapshot.sources ?? {},
    };
    calculatedAt = snapshot.calculated_at ?? calculatedAt;
  }

  const { data: overrides } = await supabase
    .from("metric_overrides")
    .select("metric_id, override_value, original_value, reason, overridden_by, created_at")
    .eq("tenant_id", tenantId)
    .eq("period_key", window.key)
    .eq("period_end", window.endDate)
    .eq("active", true);

  for (const override of overrides ?? []) {
    const existing = metrics[override.metric_id];
    if (!existing) continue;
    metrics[override.metric_id] = {
      ...existing,
      value: Number(override.override_value),
      sources: {
        ...existing.sources,
        overridden: true,
        original_value: override.original_value,
        reason: override.reason,
        overridden_by: override.overridden_by,
      },
    };
  }

  return {
    window,
    definitions: metricDefinitions,
    metrics,
    calculatedAt,
  };
}

export async function calculateAndStoreMetricSnapshots({
  tenantId,
  periodKey = "30d",
}: {
  tenantId: string;
  periodKey?: PeriodKey;
}) {
  const admin = createAdminClient();
  const window = resolvePeriod(periodKey);

  const [
    payments,
    clients,
    bankTransactions,
    salesEvents,
    socialPosts,
    memberships,
  ] = await Promise.all([
    admin.from("normalized_payments").select("*").eq("tenant_id", tenantId),
    admin.from("client_records").select("*").eq("tenant_id", tenantId),
    admin.from("bank_transactions").select("*").eq("tenant_id", tenantId),
    admin.from("sales_events").select("*").eq("tenant_id", tenantId),
    admin.from("social_posts").select("*").eq("tenant_id", tenantId),
    admin.from("tenant_memberships").select("user_id").eq("tenant_id", tenantId),
  ]);

  const firstError = payments.error ?? clients.error ?? bankTransactions.error ?? salesEvents.error ?? socialPosts.error ?? memberships.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const metrics = computeMetrics({
    window,
    payments: payments.data ?? [],
    clients: clients.data ?? [],
    bankTransactions: bankTransactions.data ?? [],
    salesEvents: salesEvents.data ?? [],
    socialPosts: socialPosts.data ?? [],
    teamHeadcount: memberships.data?.length ?? 0,
  });

  const rows = Object.values(metrics).map((metric) => ({
    tenant_id: tenantId,
    metric_id: metric.metric_id,
    period_key: window.key,
    period_start: window.startDate,
    period_end: window.endDate,
    value: metric.value,
    raw_inputs: metric.raw_inputs,
    sources: metric.sources,
    calculated_at: new Date().toISOString(),
    is_stale: false,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("metric_snapshots")
    .upsert(rows, {
      onConflict: "tenant_id,metric_id,period_key,period_start,period_end",
    });

  if (error) throw new Error(error.message);

  return { window, metrics };
}

export async function loadRawDataCounts(supabase: SupabaseLike, tenantId: string) {
  const tables = [
    ["normalized_payments", "Payments"],
    ["client_records", "Client Records"],
    ["bank_transactions", "Bank Transactions"],
    ["sales_events", "Sales Events"],
    ["form_leads", "Form Leads"],
    ["call_recordings", "Call Recordings"],
    ["social_posts", "Social Posts"],
  ] as const;

  return Promise.all(
    tables.map(async ([table, label]) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      return {
        table,
        label,
        count: error ? null : count ?? 0,
        error: error?.message ?? null,
      };
    }),
  );
}
