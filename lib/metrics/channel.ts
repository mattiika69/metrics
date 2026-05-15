import { createAdminClient } from "@/lib/supabase/admin";
import { buildConstraintsDigest, formatConstraintsForChannel } from "@/lib/metrics/constraints";
import { metricDefinitions } from "@/lib/metrics/definitions";
import { formatMetricValue } from "@/lib/metrics/format";
import { loadMetricSnapshotPayload } from "@/lib/metrics/server";

const channelMetricIds = [
  "mrr",
  "arr",
  "revenue",
  "net_profit",
  "net_margin",
  "active_clients",
  "churn",
  "calls_booked",
  "call_close_rate",
  "cac",
  "ltv_cac",
  "runway",
];

export async function buildMetricsCommandResponse(tenantId: string) {
  const admin = createAdminClient();
  const payload = await loadMetricSnapshotPayload({
    supabase: admin,
    tenantId,
    periodKey: "30d",
  });

  const definitionById = new Map(metricDefinitions.map((definition) => [definition.id, definition]));
  const lines = ["HyperOptimal Metrics - last 30 days"];

  for (const metricId of channelMetricIds) {
    const definition = definitionById.get(metricId);
    if (!definition) continue;
    const value = payload.metrics[metricId]?.value ?? null;
    lines.push(`${definition.name}: ${formatMetricValue(definition.format, value)}`);
  }

  if (!payload.calculatedAt) {
    lines.push("");
    lines.push("No snapshots are available yet. Connect integrations and run a recalculation from the web app.");
  }

  return lines.join("\n");
}

export async function buildConstraintsCommandResponse(tenantId: string) {
  const admin = createAdminClient();
  const digest = await buildConstraintsDigest({
    supabase: admin,
    tenantId,
    periodKey: "30d",
  });

  return formatConstraintsForChannel(digest.topConstraints);
}
