import { redirect } from "next/navigation";
import { getAuthBypassContext, isAuthBypassEnabled } from "@/lib/auth/bypass";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  if (isAuthBypassEnabled()) {
    const context = await getAuthBypassContext();
    return {
      supabase: context.supabase,
      user: context.user,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function requireTenant() {
  if (isAuthBypassEnabled()) {
    return getAuthBypassContext();
  }

  const { supabase, user } = await requireUser();
  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, tenants(id, name)")
    .order("created_at", { ascending: true });

  const membership = memberships?.[0];

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
