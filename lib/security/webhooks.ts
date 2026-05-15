import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookProvider = "stripe" | "slack" | "telegram";
export type WebhookStatus =
  | "processing"
  | "processed"
  | "failed"
  | "duplicate"
  | "unmapped";

export type RecordWebhookEventInput = {
  provider: WebhookProvider;
  externalEventId: string;
  eventType: string;
  tenantId?: string | null;
  payload?: Record<string, unknown>;
};

export type WebhookRecordResult =
  | {
      duplicate: false;
      id: string;
    }
  | {
      duplicate: true;
      id: string | null;
    };

export async function recordWebhookEvent(
  input: RecordWebhookEventInput,
): Promise<WebhookRecordResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      tenant_id: input.tenantId ?? null,
      provider: input.provider,
      external_event_id: input.externalEventId,
      event_type: input.eventType,
      status: "processing",
      payload: input.payload ?? {},
    })
    .select("id")
    .single();

  if (!error && data) {
    return {
      duplicate: false,
      id: data.id,
    };
  }

  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("provider", input.provider)
      .eq("external_event_id", input.externalEventId)
      .maybeSingle();

    return {
      duplicate: true,
      id: existing?.id ?? null,
    };
  }

  throw error;
}

async function updateWebhookEvent(
  id: string,
  status: WebhookStatus,
  update?: {
    tenantId?: string | null;
    error?: string | null;
  },
) {
  const supabase = createAdminClient();
  await supabase
    .from("webhook_events")
    .update({
      tenant_id: update?.tenantId ?? undefined,
      status,
      error: update?.error ?? null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function markWebhookProcessed(
  id: string,
  tenantId?: string | null,
) {
  await updateWebhookEvent(id, "processed", { tenantId: tenantId ?? null });
}

export async function markWebhookFailed(id: string, error: string) {
  await updateWebhookEvent(id, "failed", { error });
}

export async function markWebhookUnmapped(id: string) {
  await updateWebhookEvent(id, "unmapped");
}
