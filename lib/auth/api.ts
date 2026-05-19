import { getActiveTenantId } from "@/lib/auth/active-tenant";
import { getAuthBypassContext, isAuthBypassEnabled } from "@/lib/auth/bypass";
import { createClient } from "@/lib/supabase/server";

export async function requireApiTenant() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (isAuthBypassEnabled()) {
      return getAuthBypassContext();
    }

    return { error: Response.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const activeTenantId = await getActiveTenantId();
  let membership = null;

  if (activeTenantId) {
    const { data: activeMembership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, tenants(id, name)")
      .eq("tenant_id", activeTenantId)
      .eq("user_id", user.id)
      .maybeSingle();
    membership = activeMembership;
  }

  if (!membership) {
    const { data: memberships } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, tenants(id, name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    membership = memberships?.[0] ?? null;
  }

  const tenant = Array.isArray(membership?.tenants)
    ? membership.tenants[0]
    : membership?.tenants;

  if (!membership || !tenant) {
    return { error: Response.json({ error: "Tenant required." }, { status: 403 }) };
  }

  return {
    supabase,
    user,
    membership,
    tenant,
  };
}
