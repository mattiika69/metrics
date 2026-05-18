import { syncCoreIntegration } from "@/lib/integrations/core-sync";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

function isAuthorized(request: Request) {
  const secret = process.env.SCHEDULE_WORKER_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const workerSecret = request.headers.get("x-schedule-worker-secret");
  return authorization === `Bearer ${secret}` || workerSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const admin = createAdminClient();
  const { data: integrations, error } = await admin
    .from("metric_integrations")
    .select("tenant_id, provider, status")
    .in("status", ["active", "error"])
    .order("updated_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Array<{
    tenantId: string;
    provider: string;
    ok: boolean;
    rowsRead?: number;
    rowsWritten?: number;
    error?: string;
  }> = [];

  for (const integration of integrations ?? []) {
    try {
      const result = await syncCoreIntegration({
        tenantId: integration.tenant_id,
        provider: integration.provider,
        actorUserId: null,
      });
      await admin
        .from("metric_integrations")
        .update({
          status: "active",
          last_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", integration.tenant_id)
        .eq("provider", integration.provider);
      results.push({
        tenantId: integration.tenant_id,
        provider: integration.provider,
        ok: true,
        rowsRead: result.rowsRead,
        rowsWritten: result.rowsWritten,
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
        .eq("tenant_id", integration.tenant_id)
        .eq("provider", integration.provider);
      await logAuditEvent({
        tenantId: integration.tenant_id,
        eventType: "metric_integration_hourly_sync_failed",
        targetType: "integration",
        targetId: integration.provider,
        metadata: { error: message },
      });
      results.push({
        tenantId: integration.tenant_id,
        provider: integration.provider,
        ok: false,
        error: message,
      });
    }
  }

  return Response.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    count: results.length,
    results,
  });
}
