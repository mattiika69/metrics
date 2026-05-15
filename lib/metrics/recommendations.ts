import { createClaudeText } from "@/lib/ai/claude";
import { buildConstraintsDigest, formatConstraintValue } from "@/lib/metrics/constraints";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

function deterministicRecommendation(lines: string[]) {
  return [
    "Focus the next operating sprint on the highest measured gap.",
    ...lines,
    "Assign one owner, one weekly target, and one source-of-truth metric before changing multiple levers at once.",
  ].join("\n");
}

export async function loadLatestRecommendation({
  supabase,
  tenantId,
}: {
  supabase: SupabaseLike;
  tenantId: string;
}) {
  const { data } = await supabase
    .from("metric_recommendations")
    .select("id, title, body, constraints, model, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function generateAndStoreRecommendation({
  tenantId,
  actorUserId,
}: {
  tenantId: string;
  actorUserId?: string | null;
}) {
  const admin = createAdminClient();
  const digest = await buildConstraintsDigest({
    supabase: admin,
    tenantId,
    periodKey: "30d",
  });
  const top = digest.topConstraints;
  const constraintLines = top.map((row, index) => (
    `${index + 1}. ${row.benchmark.name}: actual ${formatConstraintValue(row, row.actual)}, target ${formatConstraintValue(row, row.scale)}, gap ${row.gapPercent === null ? "unknown" : `${row.gapPercent.toFixed(1)}%`}`
  ));
  const title = top[0]?.benchmark.name
    ? `Work the ${top[0].benchmark.name} constraint`
    : "Connect source data to identify constraints";

  let body = deterministicRecommendation(constraintLines);
  let model: string | null = null;

  const claudeModel = process.env.CLAUDE_MODEL ?? process.env.ANTHROPIC_MODEL;

  if (process.env.ANTHROPIC_API_KEY && claudeModel && top.length > 0) {
    try {
      model = claudeModel;
      body = await createClaudeText({
        system: "You are an operating metrics advisor for HyperOptimal Metrics. Use only the supplied tenant metric facts. Give concise, practical recommendations. Do not invent data.",
        messages: [
          {
            role: "user",
            content: [
              "Create recommendations for these top constraints.",
              "Return 4 concise bullets with concrete next actions.",
              ...constraintLines,
            ].join("\n"),
          },
        ],
        maxTokens: 600,
        temperature: 0.2,
      });
    } catch {
      model = "deterministic-fallback";
      body = deterministicRecommendation([
        ...constraintLines,
        "Use the measured constraint gaps for the next operating sprint.",
      ]);
    }
  }

  const { data, error } = await admin
    .from("metric_recommendations")
    .insert({
      tenant_id: tenantId,
      period_key: "30d",
      recommendation_type: "constraints",
      title,
      body,
      constraints: top.map((row) => ({
        benchmarkId: row.benchmark.id,
        metricId: row.benchmark.metricId,
        name: row.benchmark.name,
        actual: row.actual,
        minimum: row.minimum,
        scale: row.scale,
        gapPercent: row.gapPercent,
        status: row.status,
      })),
      source_metrics: {
        periodStart: digest.period.startDate,
        periodEnd: digest.period.endDate,
      },
      model,
      generated_by: actorUserId ?? null,
    })
    .select("id, title, body, constraints, model, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
