import { requireApiTenant } from "@/lib/auth/api";
import { getIntegrationDefinition } from "@/lib/integrations/catalog";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function canManage(role: string | undefined) {
  return role === "owner" || role === "admin";
}

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const { id } = await routeContext.params;
  const definition = getIntegrationDefinition(id);
  if (!definition) return Response.json({ error: "Integration not found." }, { status: 404 });

  if (definition.group === "Messaging") {
    const { data } = await context.supabase
      .from("tenant_integrations")
      .select("id, provider, status, external_team_id, external_channel_id, display_name, settings, created_at, updated_at")
      .eq("tenant_id", context.tenant.id)
      .eq("provider", id)
      .maybeSingle();

    return Response.json({ integration: definition, connection: data ?? null });
  }

  const { data } = await context.supabase
    .from("metric_integrations")
    .select("id, provider, status, display_name, external_account_id, settings, last_sync_at, last_event_at, last_error, created_at, updated_at")
    .eq("tenant_id", context.tenant.id)
    .eq("provider", id)
    .maybeSingle();

  return Response.json({ integration: definition, connection: data ?? null });
}

export async function POST(request: Request, routeContext: RouteContext) {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;
  if (!canManage(context.membership.role)) {
    return Response.json({ error: "Only tenant admins can manage integrations." }, { status: 403 });
  }

  const { id } = await routeContext.params;
  const definition = getIntegrationDefinition(id);
  if (!definition) return Response.json({ error: "Integration not found." }, { status: 404 });
  if (definition.comingSoon) return Response.json({ error: "Integration is coming soon." }, { status: 400 });
  if (definition.group === "Messaging") {
    return Response.json({ error: "Use the Slack OAuth or Telegram link flow for messaging integrations." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const values = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const missing = definition.fields.filter((field) => {
    const value = values[field.name];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missing.length > 0) {
    return Response.json(
      { error: `Missing required fields: ${missing.map((field) => field.label).join(", ")}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: connection, error } = await admin
    .from("metric_integrations")
    .upsert({
      tenant_id: context.tenant.id,
      provider: id,
      status: "active",
      display_name: definition.name,
      settings: { connectedFrom: "web" },
      updated_at: now,
    }, {
      onConflict: "tenant_id,provider",
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await admin.from("metric_integration_secrets").insert({
    tenant_id: context.tenant.id,
    metric_integration_id: connection.id,
    provider: id,
    secret_values: values,
  });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "metric_integration_connected",
    targetType: "integration",
    targetId: id,
    metadata: { provider: id },
  });

  return Response.json({ ok: true, id: connection.id });
}

export async function DELETE(_request: Request, routeContext: RouteContext) {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;
  if (!canManage(context.membership.role)) {
    return Response.json({ error: "Only tenant admins can manage integrations." }, { status: 403 });
  }

  const { id } = await routeContext.params;
  const definition = getIntegrationDefinition(id);
  if (!definition) return Response.json({ error: "Integration not found." }, { status: 404 });

  const admin = createAdminClient();
  if (definition.group === "Messaging") {
    await admin
      .from("tenant_integrations")
      .update({ status: "disabled", updated_at: new Date().toISOString() })
      .eq("tenant_id", context.tenant.id)
      .eq("provider", id);
  } else {
    await admin
      .from("metric_integrations")
      .update({ status: "disabled", updated_at: new Date().toISOString() })
      .eq("tenant_id", context.tenant.id)
      .eq("provider", id);
  }

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "integration_disconnected",
    targetType: "integration",
    targetId: id,
    metadata: { provider: id },
  });

  return Response.json({ ok: true });
}
