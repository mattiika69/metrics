"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function redirectWith(key: "error" | "message", value: string): never {
  redirect(`/settings/scheduling?${key}=${encodeURIComponent(value)}`);
}

function canManage(role: string) {
  return role === "owner" || role === "admin";
}

export async function createScheduleAction(formData: FormData) {
  const { supabase, tenant, user, membership } = await requireTenant();
  if (!canManage(membership.role)) {
    redirectWith("error", "Only admins can manage schedules.");
  }

  const name = formValue(formData, "name");
  const workflowKey = formValue(formData, "workflowKey") || "metrics_report";
  const cadence = formValue(formData, "cadence") || "weekly";
  const timezone = formValue(formData, "timezone") || "America/New_York";
  const targetProviders = formValues(formData, "targetProviders");

  if (!name) redirectWith("error", "Schedule name is required.");
  if (!targetProviders.length) redirectWith("error", "Choose at least one target.");

  const { error } = await supabase.from("integration_workflow_schedules").insert({
    tenant_id: tenant.id,
    name,
    workflow_key: workflowKey,
    cadence,
    timezone,
    target_providers: targetProviders,
    slack_channel_id: formValue(formData, "slackChannelId") || null,
    telegram_chat_id: formValue(formData, "telegramChatId") || null,
    message_template: formValue(formData, "messageTemplate") || null,
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  });

  if (error) redirectWith("error", error.message);

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "workflow_schedule_created",
    targetType: "integration_workflow_schedules",
    metadata: { name, workflowKey, cadence, targetProviders },
  });

  revalidatePath("/settings/scheduling");
  redirectWith("message", "Schedule created.");
}

export async function toggleScheduleAction(formData: FormData) {
  const { supabase, tenant, user, membership } = await requireTenant();
  if (!canManage(membership.role)) {
    redirectWith("error", "Only admins can manage schedules.");
  }

  const scheduleId = formValue(formData, "scheduleId");
  const enabled = formValue(formData, "enabled") === "true";
  const { error } = await supabase
    .from("integration_workflow_schedules")
    .update({
      enabled,
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", scheduleId);

  if (error) redirectWith("error", error.message);

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: enabled ? "workflow_schedule_enabled" : "workflow_schedule_disabled",
    targetType: "integration_workflow_schedules",
    targetId: scheduleId,
  });

  revalidatePath("/settings/scheduling");
  redirectWith("message", enabled ? "Schedule enabled." : "Schedule paused.");
}

export async function archiveScheduleAction(formData: FormData) {
  const { supabase, tenant, user, membership } = await requireTenant();
  if (!canManage(membership.role)) {
    redirectWith("error", "Only admins can manage schedules.");
  }

  const scheduleId = formValue(formData, "scheduleId");
  const { error } = await supabase
    .from("integration_workflow_schedules")
    .update({
      archived_at: new Date().toISOString(),
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", scheduleId);

  if (error) redirectWith("error", error.message);

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "workflow_schedule_archived",
    targetType: "integration_workflow_schedules",
    targetId: scheduleId,
  });

  revalidatePath("/settings/scheduling");
  redirectWith("message", "Schedule archived.");
}

export async function runScheduleNowAction(formData: FormData) {
  const { tenant, user, membership } = await requireTenant();
  if (!canManage(membership.role)) {
    redirectWith("error", "Only admins can run schedules.");
  }

  const scheduleId = formValue(formData, "scheduleId");
  const admin = createAdminClient();
  const { data: schedule, error: readError } = await admin
    .from("integration_workflow_schedules")
    .select("id, workflow_key, target_providers, slack_channel_id, telegram_chat_id")
    .eq("tenant_id", tenant.id)
    .eq("id", scheduleId)
    .maybeSingle();

  if (readError || !schedule) {
    redirectWith("error", readError?.message ?? "Schedule not found.");
  }

  const { data: run, error } = await admin
    .from("integration_workflow_runs")
    .insert({
      tenant_id: tenant.id,
      schedule_id: schedule.id,
      status: "running",
      target_provider: Array.isArray(schedule.target_providers)
        ? schedule.target_providers.join(",")
        : null,
      target_channel_id: schedule.slack_channel_id ?? schedule.telegram_chat_id ?? null,
      started_at: new Date().toISOString(),
      idempotency_key: `${schedule.id}:manual:${Date.now()}`,
    })
    .select("id")
    .single();

  if (error) redirectWith("error", error.message);

  await admin
    .from("integration_workflow_runs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      output_metadata: { workflowKey: schedule.workflow_key, runMode: "manual" },
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  await admin.from("integration_workflow_run_events").insert({
    tenant_id: tenant.id,
    run_id: run.id,
    event_type: "manual_run_completed",
    metadata: { workflowKey: schedule.workflow_key },
  });

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "workflow_schedule_run_now",
    targetType: "integration_workflow_schedules",
    targetId: schedule.id,
    metadata: { runId: run.id },
  });

  revalidatePath("/settings/scheduling");
  redirectWith("message", "Schedule run recorded.");
}
