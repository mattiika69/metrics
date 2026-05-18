import { requireApiTenant } from "@/lib/auth/api";
import { getIntegrationDefinition } from "@/lib/integrations/catalog";
import { syncCoreIntegration } from "@/lib/integrations/core-sync";
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
    return Response.json({ error: "This connection refreshes automatically." }, { status: 400 });
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

  try {
    const result = await syncCoreIntegration({
      tenantId: context.tenant.id,
      provider: id,
      actorUserId: context.user.id,
    });
    await admin
      .from("metric_integrations")
      .update({
        status: "active",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", context.tenant.id)
      .eq("provider", id);
    await logAuditEvent({
      tenantId: context.tenant.id,
      actorUserId: context.user.id,
      eventType: "metric_integration_synced",
      targetType: "integration",
      targetId: id,
      metadata: result,
    });

    return Response.json({
      ok: true,
      syncedAt: now,
      ...result,
    });
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : "Sync failed.";
    await admin
      .from("metric_integrations")
      .update({
        status: "error",
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", context.tenant.id)
      .eq("provider", id);
    await logAuditEvent({
      tenantId: context.tenant.id,
      actorUserId: context.user.id,
      eventType: "metric_integration_sync_failed",
      targetType: "integration",
      targetId: id,
      metadata: { provider: id, error: message },
    });
    return Response.json({ error: message }, { status: 400 });
  }
}
