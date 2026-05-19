import "server-only";

import { redirect } from "next/navigation";
import { getActiveTenantId } from "@/lib/auth/active-tenant";
import { getAuthBypassContext, isAuthBypassEnabled } from "@/lib/auth/bypass";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    return { supabase, user };
  }

  if (isAuthBypassEnabled()) {
    const context = await getAuthBypassContext();
    return {
      supabase: context.supabase,
      user: context.user,
    };
  }

  redirect("/login");
}

export async function requireTenant() {
  const { supabase, user } = await requireUser();
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
      .order("created_at", { ascending: true });

    membership = memberships?.[0] ?? null;
  }

  if (!membership) {
    redirect("/get-started");
  }

  const tenant = Array.isArray(membership.tenants)
    ? membership.tenants[0]
    : membership.tenants;

  if (!tenant) {
    redirect("/get-started");
  }

  return {
    supabase,
    user,
    tenant,
    membership,
  };
}
