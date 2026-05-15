import { requireApiTenant } from "@/lib/auth/api";
import { getIntegrationDefinition } from "@/lib/integrations/catalog";
import { calculateAndStoreMetricSnapshots } from "@/lib/metrics/server";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, routeContext: RouteContext) {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const { id } = await routeContext.params;
  const definition = getIntegrationDefinition(id);
  if (!definition) return Response.json({ error: "Integration not found." }, { status: 404 });
  if (definition.group === "Messaging") {
    return Response.json({ error: "Messaging integrations do not use source sync." }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("metric_integrations")
    .upsert({
      tenant_id: context.tenant.id,
      provider: id,
      display_name: definition.name,
      status: "active",
      last_sync_at: now,
      last_error: null,
      updated_at: now,
    }, {
      onConflict: "tenant_id,provider",
    });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await calculateAndStoreMetricSnapshots({
    tenantId: context.tenant.id,
    periodKey: "30d",
  });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "metric_integration_sync_requested",
    targetType: "integration",
    targetId: id,
    metadata: {
      provider: id,
      note: "Provider-specific ingestion runs behind this integration sync surface.",
    },
  });

  return Response.json({
    ok: true,
    syncedAt: now,
    message: "Integration marked synced and metrics recalculated from persisted source rows.",
  });
}
