import { createAdminClient } from "@/lib/supabase/admin";
import { buildConstraintsDigest, formatConstraintsForChannel } from "@/lib/metrics/constraints";
import { metricDefinitions } from "@/lib/metrics/definitions";
import { formatMetricValue } from "@/lib/metrics/format";
import { buildForecastContext } from "@/lib/metrics/forecasting";
import { loadMetricSnapshotPayload } from "@/lib/metrics/server";
import { getMetricViewDefinition, loadMetricViewPayload, type MetricViewKey } from "@/lib/metrics/views";

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

export type ChannelCommand =
  | "metrics"
  | "constraints"
  | "forecast"
  | "inputs"
  | "marketing"
  | "sales"
  | "retention"
  | "finance";

const commandByToken = new Map<string, ChannelCommand>([
  ["metrics", "metrics"],
  ["dashboard", "metrics"],
  ["ceo", "metrics"],
  ["constraints", "constraints"],
  ["constraint", "constraints"],
  ["forecast", "forecast"],
  ["forecasting", "forecast"],
  ["inputs", "inputs"],
  ["marketing", "marketing"],
  ["sales", "sales"],
  ["retention", "retention"],
  ["finance", "finance"],
]);

export function resolveChannelCommand(text: string | null | undefined): ChannelCommand | null {
  const value = (text ?? "").toLowerCase();
  for (const [token, command] of commandByToken) {
    if (new RegExp(`(^|[\\s/])${token}($|[\\s])`).test(value)) return command;
  }
  return null;
}

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
    lines.push("No metric data yet. Connect data sources and refresh metrics in the app.");
  }

  return lines.join("\n");
}

export async function buildMetricViewCommandResponse(tenantId: string, viewKey: MetricViewKey) {
  const admin = createAdminClient();
  const payload = await loadMetricViewPayload({ supabase: admin, tenantId, viewKey });
  const lines = [`${getMetricViewDefinition(viewKey).title} - last 30 days`];

  for (const row of payload.rows.slice(0, 12)) {
    lines.push(`${row.name}: ${row.displayValue}`);
  }

  if (!payload.calculatedAt) {
    lines.push("");
    lines.push("No metric data yet. Connect data sources and refresh metrics in the app.");
  }

  return lines.join("\n");
}

export async function buildForecastCommandResponse(tenantId: string) {
  const admin = createAdminClient();
  const forecast = await buildForecastContext({ supabase: admin, tenantId });
  return [
    "Forecast - current model",
    `Revenue required: ${formatMetricValue("currency", forecast.model.outputs.revenueRequired)}`,
    `Clients required: ${formatMetricValue("number", forecast.model.outputs.clientsRequired)}`,
    `Booked calls required: ${formatMetricValue("number", forecast.model.outputs.bookedCallsRequired)}`,
    `Acquisition spend required: ${formatMetricValue("currency", forecast.model.outputs.acquisitionSpendRequired)}`,
    `Daily spend required: ${formatMetricValue("currency", forecast.model.outputs.dailySpendRequired)}`,
  ].join("\n");
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

export async function buildChannelCommandResponse(tenantId: string, command: ChannelCommand) {
  if (command === "constraints") return buildConstraintsCommandResponse(tenantId);
  if (command === "forecast") return buildForecastCommandResponse(tenantId);
  if (command === "inputs") return buildMetricViewCommandResponse(tenantId, "marketing");
  if (command === "marketing") return buildMetricViewCommandResponse(tenantId, "marketing");
  if (command === "sales") return buildMetricViewCommandResponse(tenantId, "sales");
  if (command === "retention") return buildMetricViewCommandResponse(tenantId, "retention");
  if (command === "finance") return buildMetricViewCommandResponse(tenantId, "finance");
  return buildMetricsCommandResponse(tenantId);
}
