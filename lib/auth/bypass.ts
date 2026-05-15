import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BYPASS_EMAIL = "matt@1000xleads.com";
const DEFAULT_BYPASS_TENANT_NAME = "Matthew";

type BypassUser = {
  id: string;
  email: string;
};

type BypassTenant = {
  id: string;
  name: string;
};

type BypassMembership = {
  tenant_id: string;
  role: "owner" | "admin" | "member";
  tenants: BypassTenant;
};

export function isAuthBypassEnabled() {
  return process.env.AUTH_BYPASS_ENABLED === "true";
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return { id: user.id, email: user.email ?? email };
    if (data.users.length < 100) break;

    page += 1;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: {
      temporary_auth_bypass: true,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error("Unable to create temporary bypass user.");
  }

  return { id: data.user.id, email: data.user.email ?? email };
}

export async function getAuthBypassContext() {
  const admin = createAdminClient();
  const email = process.env.AUTH_BYPASS_USER_EMAIL ?? DEFAULT_BYPASS_EMAIL;
  const tenantName = process.env.AUTH_BYPASS_TENANT_NAME ?? DEFAULT_BYPASS_TENANT_NAME;
  const user = (await findAuthUserByEmail(email)) as BypassUser;

  const { data: existingTenants, error: tenantReadError } = await admin
    .from("tenants")
    .select("id, name")
    .eq("name", tenantName)
    .order("created_at", { ascending: true })
    .limit(1);

  if (tenantReadError) throw tenantReadError;

  const tenant =
    existingTenants?.[0] ??
    (
      await admin
        .from("tenants")
        .insert({
          name: tenantName,
          created_by: user.id,
        })
        .select("id, name")
        .single()
    ).data;

  if (!tenant) throw new Error("Unable to resolve temporary bypass tenant.");

  const { data: membership, error: membershipError } = await admin
    .from("tenant_memberships")
    .upsert(
      {
        tenant_id: tenant.id,
        user_id: user.id,
        role: "owner",
      },
      { onConflict: "tenant_id,user_id" },
    )
    .select("tenant_id, role")
    .single();

  if (membershipError || !membership) {
    throw membershipError ?? new Error("Unable to resolve temporary bypass membership.");
  }

  return {
    supabase: admin,
    user,
    tenant,
    membership: {
      tenant_id: membership.tenant_id,
      role: membership.role,
      tenants: tenant,
    } as BypassMembership,
  };
}
