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
  return (
    process.env.DISABLE_LOGIN_AUTH === "true" ||
    process.env.AUTH_BYPASS_ENABLED === "true"
  );
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const { data: lookupRows } = await admin.rpc("find_auth_user_id_by_email", {
    target_email: email,
  });
  const lookupRow = Array.isArray(lookupRows) ? lookupRows[0] : null;

  if (lookupRow?.id) {
    return { id: lookupRow.id, email: lookupRow.email ?? email };
  }

  let page = 1;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
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

  if (error?.code === "email_exists") {
    const { data: fallbackRows } = await admin.rpc("find_auth_user_id_by_email", {
      target_email: email,
    });
    const fallbackRow = Array.isArray(fallbackRows) ? fallbackRows[0] : null;
    if (fallbackRow?.id) {
      return { id: fallbackRow.id, email: fallbackRow.email ?? email };
    }
  }

  if (error || !data.user) {
    throw error ?? new Error("Unable to create temporary bypass user.");
  }

  return { id: data.user.id, email: data.user.email ?? email };
}

export async function getAuthBypassContext() {
  const admin = createAdminClient();
  const email =
    process.env.AUTH_BYPASS_EMAIL ??
    process.env.AUTH_BYPASS_USER_EMAIL ??
    DEFAULT_BYPASS_EMAIL;
  const tenantName = process.env.AUTH_BYPASS_TENANT_NAME ?? DEFAULT_BYPASS_TENANT_NAME;
  const configuredUserId = process.env.AUTH_BYPASS_USER_ID;
  const configuredTenantId = process.env.AUTH_BYPASS_TENANT_ID;
  const user = configuredUserId
    ? ({ id: configuredUserId, email } as BypassUser)
    : ((await findAuthUserByEmail(email)) as BypassUser);

  const tenantQuery = admin.from("tenants").select("id, name").limit(1);
  const { data: existingTenants, error: tenantReadError } = configuredTenantId
    ? await tenantQuery.eq("id", configuredTenantId)
    : await tenantQuery.eq("name", tenantName).order("created_at", { ascending: true });

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
