"use server";

import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { getIntegrationDefinition } from "@/lib/integrations/catalog";
import { importCsvBanking, syncCoreIntegration } from "@/lib/integrations/core-sync";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { createTelegramLinkCode } from "@/lib/integrations/telegram";
import { calculateForecast, normalizeForecastAssumptions } from "@/lib/metrics/forecasting";
import { generateAndStoreRecommendation } from "@/lib/metrics/recommendations";
import { getMetricDefinition } from "@/lib/metrics/definitions";
import { calculateAndStoreMetricSnapshots, loadMetricSnapshotPayload, periodFromSearch } from "@/lib/metrics/server";
import { allMetricViewKeys, getMetricViewDefinition, type MetricViewKey } from "@/lib/metrics/views";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function redirectWith(path: string, key: "message" | "error", value: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${key}=${encodeURIComponent(value)}`);
}

function parseViewKey(value: string): MetricViewKey {
  return allMetricViewKeys().includes(value as MetricViewKey) ? value as MetricViewKey : "ceo";
}

export async function recalculateMetricsAction(formData: FormData) {
  const { tenant, user } = await requireTenant();
  const period = periodFromSearch(String(formData.get("period") ?? "30d"));
  const next = safeNextPath(formText(formData, "next"), "/dashboard");
  await calculateAndStoreMetricSnapshots({ tenantId: tenant.id, periodKey: period });
  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "metrics_recalculated",
    targetType: "metric_snapshots",
    metadata: { period },
  });
  redirectWith(next, "message", "Metrics recalculated");
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

export async function saveBusinessProfileAction(formData: FormData) {
  const { tenant, user, supabase } = await requireTenant();
  const next = safeNextPath(formText(formData, "next"), "/get-started");
  const teamSize = Number(formText(formData, "teamSize"));
  const completeOnboarding = formData.get("completeOnboarding") === "true";

  const { error } = await supabase.from("tenant_business_profiles").upsert({
    tenant_id: tenant.id,
    business_type: formText(formData, "businessType") || "service",
    offer_model: formText(formData, "offerModel") || "high_ticket",
    stage: formText(formData, "stage") || "mvp",
    revenue_band: formText(formData, "revenueBand") || "unknown",
    team_size: Number.isFinite(teamSize) && teamSize > 0 ? teamSize : null,
    timezone: formText(formData, "timezone") || "America/New_York",
    benchmark_opt_in: formData.get("benchmarkOptIn") === "on",
    onboarding_completed_at: completeOnboarding ? new Date().toISOString() : null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "tenant_id",
  });

  if (error) redirectWith(next, "error", error.message);

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "business_profile_saved",
    targetType: "tenant_business_profile",
    targetId: tenant.id,
  });
  redirectWith(next, "message", "Business profile saved");
}

export async function saveMetricSelectionsAction(formData: FormData) {
  const { tenant, user, supabase } = await requireTenant();
  const viewKey = parseViewKey(formText(formData, "viewKey"));
  const next = safeNextPath(formText(formData, "next"), getMetricViewDefinition(viewKey).href);
  const metricIds = Array.from(new Set(formData.getAll("metricId")
    .map((value) => typeof value === "string" ? value : "")
    .filter((metricId) => getMetricDefinition(metricId))));

  const deleteResult = await supabase
    .from("tenant_metric_selections")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("view_key", viewKey);

  if (deleteResult.error) redirectWith(next, "error", deleteResult.error.message);

  if (metricIds.length) {
    const { error } = await supabase.from("tenant_metric_selections").insert(metricIds.map((metricId, index) => ({
      tenant_id: tenant.id,
      view_key: viewKey,
      metric_id: metricId,
      display_order: index,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    })));
    if (error) redirectWith(next, "error", error.message);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "metric_selection_saved",
    targetType: "metric_view",
    targetId: viewKey,
    metadata: { metricIds },
  });
  redirectWith(next, "message", "Metric selection saved");
}

export async function createMetricRequestAction(formData: FormData) {
  const { tenant, user, supabase } = await requireTenant();
  const next = safeNextPath(formText(formData, "next"), "/dashboard");
  const requestedMetric = formText(formData, "requestedMetric");
  const context = formText(formData, "context");
  const source = formText(formData, "source") || "web";

  if (!requestedMetric) redirectWith(next, "error", "Metric name is required");

  const { data, error } = await supabase
    .from("metric_requests")
    .insert({
      tenant_id: tenant.id,
      requested_metric: requestedMetric,
      context: context || null,
      source,
      requested_by: user.id,
    })
    .select("id")
    .single();

  if (error) redirectWith(next, "error", error.message);

  const adminChatId = process.env.INTERNAL_TELEGRAM_CHAT_ID ?? process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId && process.env.TELEGRAM_BOT_TOKEN) {
    const result = await sendTelegramMessage({
      chatId: adminChatId,
      text: [
        "New HyperOptimal Metrics request",
        `Tenant: ${tenant.name}`,
        `Metric: ${requestedMetric}`,
        context ? `Context: ${context}` : null,
      ].filter(Boolean).join("\n"),
    });
    if (result.ok) {
      await supabase
        .from("metric_requests")
        .update({ notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("tenant_id", tenant.id);
    }
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "metric_request_created",
    targetType: "metric_request",
    targetId: data.id,
    metadata: { requestedMetric, source },
  });
  redirectWith(next, "message", "Metric request saved");
}

export async function saveForecastModelAction(formData: FormData) {
  const { tenant, user, supabase } = await requireTenant();
  const next = safeNextPath(formText(formData, "next"), "/forecasting");
  const assumptions = normalizeForecastAssumptions({
    netProfitGoal: formText(formData, "netProfitGoal"),
    netMarginPercent: formText(formData, "netMarginPercent"),
    monthlyClientPayment: formText(formData, "monthlyClientPayment"),
    churnPercent: formText(formData, "churnPercent"),
    showRatePercent: formText(formData, "showRatePercent"),
    closeRatePercent: formText(formData, "closeRatePercent"),
    costPerCall: formText(formData, "costPerCall"),
  });
  const outputs = calculateForecast(assumptions);

  const existing = await supabase
    .from("metric_forecast_models")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("active", true);
  if (existing.error) redirectWith(next, "error", existing.error.message);

  const { data, error } = await supabase
    .from("metric_forecast_models")
    .insert({
      tenant_id: tenant.id,
      name: formText(formData, "name") || "Default forecast",
      period_key: "30d",
      assumptions,
      outputs,
      active: true,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error) redirectWith(next, "error", error.message);

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "forecast_model_saved",
    targetType: "metric_forecast_model",
    targetId: data.id,
    metadata: { assumptions, outputs },
  });
  redirectWith(next, "message", "Forecast saved");
}

export async function refreshRecommendationAction(formData: FormData) {
  const { tenant, user } = await requireTenant();
  const next = safeNextPath(formText(formData, "next"), "/dashboard");
  const recommendation = await generateAndStoreRecommendation({
    tenantId: tenant.id,
    actorUserId: user.id,
  });
  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "metric_recommendation_generated",
    targetType: "metric_recommendation",
    targetId: recommendation.id,
  });
  redirectWith(next, "message", "Recommendation refreshed");
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
    redirect("/settings/integrations?message=Only tenant admins can manage integrations");
  }

  const provider = String(formData.get("provider") ?? "");
  const definition = getIntegrationDefinition(provider);
  if (!definition || definition.comingSoon || definition.group === "Messaging") {
    redirect(`/settings/integrations?message=Use the dedicated connection flow`);
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
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "tenant_id,provider",
  });

  let resultMessage = "Sync complete";
  try {
    const result = await syncCoreIntegration({ tenantId: tenant.id, provider, actorUserId: user.id });
    resultMessage = result.message;
    await admin
      .from("metric_integrations")
      .update({
        status: "active",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant.id)
      .eq("provider", provider);
    await logAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: "metric_integration_synced",
      targetType: "integration",
      targetId: provider,
      metadata: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await admin
      .from("metric_integrations")
      .update({
        status: "error",
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant.id)
      .eq("provider", provider);
    await logAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: "metric_integration_sync_failed",
      targetType: "integration",
      targetId: provider,
      metadata: { error: message },
    });
    redirectWith(`/integrations/${provider}`, "error", message);
  }
  redirectWith(`/integrations/${provider}`, "message", resultMessage);
}

export async function importCsvBankingAction(formData: FormData) {
  const { tenant, user } = await requireTenant();
  const csvTextField = formData.get("csvText");
  const csvFile = formData.get("csvFile");
  const csvText = typeof csvTextField === "string" && csvTextField.trim()
    ? csvTextField
    : typeof File !== "undefined" && csvFile instanceof File
      ? await csvFile.text()
      : "";

  if (!csvText.trim()) redirectWith("/integrations/csv-banking", "error", "CSV data is required");

  let resultMessage = "CSV banking rows imported.";
  try {
    const result = await importCsvBanking({
      tenantId: tenant.id,
      csvText,
      actorUserId: user.id,
    });
    resultMessage = result.message;
    await logAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: "csv_banking_imported",
      targetType: "integration",
      targetId: "csv-banking",
      metadata: result,
    });
  } catch (error) {
    redirectWith("/integrations/csv-banking", "error", error instanceof Error ? error.message : "CSV import failed");
  }
  redirectWith("/integrations/csv-banking", "message", resultMessage);
}

export async function createTelegramLinkCodeAction() {
  const { tenant, user, membership } = await requireTenant();
  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/settings/telegram?message=Only tenant admins can create Telegram link codes");
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
  redirect(`/settings/telegram?code=${code}&expires=${encodeURIComponent(expiresAt)}`);
}
