import { createAdminClient } from "@/lib/supabase/admin";

type AuditMetadata = Record<string, unknown>;

export type AuditEventInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  targetType?: string | null;
  targetId?: string | null;
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
    ]);
  } catch (error) {
    console.error("audit log failed", error);
  }
}
