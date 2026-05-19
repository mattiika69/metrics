import { NextResponse } from "next/server";
import { setActiveTenantId } from "@/lib/auth/active-tenant";
import { sanitizeAuthRedirect } from "@/lib/auth/redirects";
import { logAuditEvent } from "@/lib/security/audit";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext =
    requestUrl.searchParams.get("redirect") ?? requestUrl.searchParams.get("next");
  const next = sanitizeAuthRedirect(requestedNext, "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.redirect(
          new URL("/login?error=Unable%20to%20confirm%20auth%20session.", requestUrl.origin),
        );
      }

      if (next.startsWith("/settings/team/accept")) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      const { data: memberships } = await supabase
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const existingTenantId = memberships?.[0]?.tenant_id ?? null;
      if (existingTenantId) {
        await setActiveTenantId(existingTenantId);
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      const metadata = user.user_metadata as Record<string, unknown>;
      const organizationName =
        typeof metadata.onboarding_organization_name === "string"
          ? metadata.onboarding_organization_name.trim()
          : typeof metadata.organization_name === "string"
            ? metadata.organization_name.trim()
            : "";

      if (!organizationName) {
        return NextResponse.redirect(
          new URL(
            "/login?error=Organization%20setup%20could%20not%20be%20resolved.%20Please%20sign%20in%20and%20continue%20setup.",
            requestUrl.origin,
          ),
        );
      }

      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: organizationName,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (tenantError || !tenant) {
        await logAuditEvent({
          actorUserId: user.id,
          eventType: "workspace_create_failed",
          targetType: "tenant",
          metadata: {
            source: "auth_callback",
            error: tenantError?.message ?? "Tenant was not returned.",
          },
        });
        return NextResponse.redirect(
          new URL(
            "/login?error=Organization%20setup%20could%20not%20be%20completed.%20Please%20sign%20in%20and%20try%20again.",
            requestUrl.origin,
          ),
        );
      }

      await setActiveTenantId(tenant.id);
      await logAuditEvent({
        tenantId: tenant.id,
        actorUserId: user.id,
        eventType: "workspace_created",
        targetType: "tenant",
        targetId: tenant.id,
        metadata: {
          source: "auth_callback",
        },
      });

      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=Your%20email%20link%20has%20expired.%20Please%20request%20a%20new%20one.", requestUrl.origin),
  );
}
