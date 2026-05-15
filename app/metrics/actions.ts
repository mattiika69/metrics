"use server";

import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { getIntegrationDefinition } from "@/lib/integrations/catalog";
import { createTelegramLinkCode } from "@/lib/integrations/telegram";
import { getMetricDefinition } from "@/lib/metrics/definitions";
import { calculateAndStoreMetricSnapshots, loadMetricSnapshotPayload, periodFromSearch } from "@/lib/metrics/server";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function recalculateMetricsAction(formData: FormData) {
  const { tenant, user } = await requireTenant();
  const period = periodFromSearch(String(formData.get("period") ?? "30d"));
  await calculateAndStoreMetricSnapshots({ tenantId: tenant.id, periodKey: period });
  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "metrics_recalculated",
    targetType: "metric_snapshots",
    metadata: { period },
  });
  redirect(`/metrics/most-important?period=${period}&message=Metrics recalculated`);
}

export async function createMetricOverrideAction(formData: FormData) {
  const { tenant, user, supabase } = await requireTenant();
  const metricId = String(formData.get("metricId") ?? "");
  const period = periodFromSearch(String(formData.get("period") ?? "30d"));
  const value = Number(formData.get("value"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!getMetricDefinition(metricId) || !Number.isFinite(value)) {
    redirect(`/metrics/most-important?period=${period}&message=Invalid override`);
  }

  const payload = await loadMetricSnapshotPayload({ supabase, tenantId: tenant.id, periodKey: period });
  const admin = createAdminClient();
  await admin
    .from("metric_overrides")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("metric_id", metricId)
    .eq("period_key", payload.window.key)
    .eq("period_end", payload.window.endDate)
    .eq("active", true);
  await admin.from("metric_overrides").insert({
    tenant_id: tenant.id,
    metric_id: metricId,
    period_key: payload.window.key,
    period_end: payload.window.endDate,
    override_value: value,
    original_value: payload.metrics[metricId]?.value ?? null,
    reason: reason || null,
    overridden_by: user.id,
  });
  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "metric_override_created",
    targetType: "metric",
    targetId: metricId,
    metadata: { period, value, reason },
  });
  redirect(`/metrics/most-important?period=${period}&message=Override saved`);
}

export async function createMetricPrincipleAction(formData: FormData) {
  const { tenant, user, supabase } = await requireTenant();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const videoUrl = String(formData.get("videoUrl") ?? "").trim();
  if (!title || !description) redirect("/metrics/principles?message=Title and description are required");

  const { count } = await supabase
    .from("metric_principles")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);

  await supabase.from("metric_principles").insert({
    tenant_id: tenant.id,
    title,
    description,
    video_url: videoUrl || null,
    display_order: count ?? 0,
    created_by: user.id,
  });
  redirect("/metrics/principles?message=Principle saved");
}

export async function saveBenchmarkTargetAction(formData: FormData) {
  const { tenant, supabase } = await requireTenant();
  const benchmarkId = String(formData.get("benchmarkId") ?? "");
  const targetValue = Number(formData.get("targetValue"));
  if (!benchmarkId || !Number.isFinite(targetValue)) {
    redirect("/metrics/benchmarking?message=Invalid benchmark target");
  }

  await supabase.from("metric_benchmark_targets").upsert({
    tenant_id: tenant.id,
    benchmark_id: benchmarkId,
    target_value: targetValue,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "tenant_id,benchmark_id",
  });
  redirect("/metrics/benchmarking?message=Benchmark target saved");
}

export async function saveQualityChecklistAction(formData: FormData) {
  const { tenant, user, supabase } = await requireTenant();
  const weekStartDate = String(formData.get("weekStartDate") ?? "");
  const itemIds = ["sales_calls", "transactions_in", "transactions_out", "categories", "client_data", "client_payments"];
  const items = itemIds.map((id) => ({
    id,
    completed: formData.get(id) === "on",
    completedAt: formData.get(id) === "on" ? new Date().toISOString() : null,
  }));

  await supabase.from("metric_quality_checklists").upsert({
    tenant_id: tenant.id,
    week_start_date: weekStartDate,
    items,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "tenant_id,week_start_date",
  });
  redirect("/metrics/quality-assurance?message=Quality checklist saved");
}

export async function connectIntegrationAction(formData: FormData) {
  const { tenant, user, membership } = await requireTenant();
  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/integrations?message=Only tenant admins can manage integrations");
  }

  const provider = String(formData.get("provider") ?? "");
  const definition = getIntegrationDefinition(provider);
  if (!definition || definition.comingSoon || definition.group === "Messaging") {
    redirect(`/integrations/${provider}?message=Use the dedicated connection flow`);
  }

  const values: Record<string, string> = {};
  for (const field of definition.fields) {
    values[field.name] = String(formData.get(field.name) ?? "").trim();
    if (!values[field.name]) redirect(`/integrations/${provider}?message=Missing ${field.label}`);
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("metric_integrations")
    .upsert({
      tenant_id: tenant.id,
      provider,
      status: "active",
      display_name: definition.name,
      settings: { connectedFrom: "web" },
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "tenant_id,provider",
    })
    .select("id")
    .single();

  if (data) {
    await admin.from("metric_integration_secrets").insert({
      tenant_id: tenant.id,
      metric_integration_id: data.id,
      provider,
      secret_values: values,
    });
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "metric_integration_connected",
    targetType: "integration",
    targetId: provider,
  });
  redirect(`/integrations/${provider}?message=Integration connected`);
}

export async function syncIntegrationAction(formData: FormData) {
  const { tenant, user } = await requireTenant();
  const provider = String(formData.get("provider") ?? "");
  const definition = getIntegrationDefinition(provider);
  if (!definition || definition.group === "Messaging") redirect(`/integrations/${provider}`);

  const admin = createAdminClient();
  await admin.from("metric_integrations").upsert({
    tenant_id: tenant.id,
    provider,
    status: "active",
    display_name: definition.name,
    last_sync_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "tenant_id,provider",
  });
  await calculateAndStoreMetricSnapshots({ tenantId: tenant.id, periodKey: "30d" });
  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "metric_integration_sync_requested",
    targetType: "integration",
    targetId: provider,
  });
  redirect(`/integrations/${provider}?message=Sync recorded and metrics recalculated`);
}

export async function createTelegramLinkCodeAction() {
  const { tenant, user, membership } = await requireTenant();
  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/integrations/telegram?message=Only tenant admins can create Telegram link codes");
  }

  const code = createTelegramLinkCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  await admin.from("telegram_link_codes").insert({
    tenant_id: tenant.id,
    created_by: user.id,
    code,
    expires_at: expiresAt,
  });
  redirect(`/integrations/telegram?code=${code}&expires=${encodeURIComponent(expiresAt)}`);
}
