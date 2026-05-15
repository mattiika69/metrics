import { getAuthBypassContext, isAuthBypassEnabled } from "@/lib/auth/bypass";
import { createClient } from "@/lib/supabase/server";

export async function requireApiTenant() {
  if (isAuthBypassEnabled()) {
    return getAuthBypassContext();
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: Response.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, tenants(id, name)")
    .order("created_at", { ascending: true })
    .limit(1);

  const membership = memberships?.[0];
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
