import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type AuditMetadata = Record<string, unknown>;

export type AuditEventInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  platform?: "web" | "slack" | "telegram" | null;
  eventType: string;
  targetType?: string | null;
  targetId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: AuditMetadata;
};

export async function logAuditEvent(input: AuditEventInput) {
  try {
    const supabase = createAdminClient();
    const payload = {
      tenant_id: input.tenantId ?? null,
      actor_user_id: input.actorUserId ?? null,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? {},
    };

    await Promise.all([
      supabase.from("audit_events").insert({
        ...payload,
        event_type: input.eventType,
      }),
      supabase.from("admin_audit_log").insert({
        ...payload,
        action: input.eventType,
      }),
      supabase.from("audit_logs").insert({
        tenant_id: input.tenantId ?? null,
        actor_user_id: input.actorUserId ?? null,
        platform: input.platform ?? null,
        action: input.eventType,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        before_state: input.beforeState ?? null,
        after_state: input.afterState ?? null,
        metadata: input.metadata ?? {},
      }),
    ]);
  } catch (error) {
    console.error("audit log failed", error);
  }
}
