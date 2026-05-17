import "server-only";

import type { AdminContext } from "@/lib/admin/auth";

export type AdminNotice = {
  label: string;
  message: string;
};

export type AdminUserRow = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  tenantNames: string[];
  subscriptionStatus: string | null;
};

export type AdminOrgRow = {
  tenantId: string;
  name: string;
  ownerEmail: string | null;
  plan: string | null;
  createdAt: string | null;
  memberCount: number;
  integrationStatus: string;
};

export type AdminBillingRow = {
  tenantName: string | null;
  customerEmail: string | null;
  plan: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export type WebhookEventRow = {
  id: string;
  provider: string;
  eventType: string;
  status: string;
  createdAt: string;
  errorMessage: string | null;
};

export type AuditEventRow = {
  id: string;
  actor: string | null;
  action: string;
  target: string | null;
  createdAt: string;
  metadataPreview: string;
};

export type AdminOverview = {
  notices: AdminNotice[];
  totalUsers: number;
  totalTenants: number;
  activeSubscriptions: number;
  recentSignups: AdminUserRow[];
  recentWebhookEvents: WebhookEventRow[];
  recentAuditEvents: AuditEventRow[];
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
};

type AuthUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
};

type ProfileRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  is_admin?: boolean | null;
  created_at?: string | null;
};

type TenantRow = {
  id: string;
  name: string;
  created_by?: string | null;
  created_at?: string | null;
};

type MembershipRow = {
  tenant_id: string;
  user_id: string;
  role: string;
};

type BillingCustomerRow = {
  tenant_id: string;
  stripe_customer_id: string;
};

type BillingSubscriptionRow = {
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string | null;
  current_period_end: string | null;
};

type TenantIntegrationRow = {
  tenant_id: string;
  provider: string;
  status: string;
};

type WebhookEventRawRow = {
  id: string;
  provider: string;
  event_type: string;
  status: string;
  created_at: string;
  error: string | null;
};

type AuditEventRawRow = {
  id: string;
  actor_user_id: string | null;
  action?: string | null;
  event_type?: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function addNotice(notices: AdminNotice[], label: string, error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  notices.push({ label, message });
}

async function safeRows<T>(
  notices: AdminNotice[],
  label: string,
  query: PromiseLike<QueryResult<T[]>>,
) {
  try {
    const { data, error } = await query;
    if (error) {
      addNotice(notices, label, error);
      return [] as T[];
    }
    return (data ?? []) as T[];
  } catch (error) {
    addNotice(notices, label, error);
    return [] as T[];
  }
}

async function safeCount(
  notices: AdminNotice[],
  label: string,
  query: PromiseLike<QueryResult<unknown>>,
) {
  try {
    const { count, error } = await query;
    if (error) {
      addNotice(notices, label, error);
      return 0;
    }
    return count ?? 0;
  } catch (error) {
    addNotice(notices, label, error);
    return 0;
  }
}

async function listAuthUsers(context: AdminContext, notices: AdminNotice[]) {
  try {
    const { data, error } = await context.admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      addNotice(notices, "Auth users", error);
      return [] as AuthUser[];
    }

    return data.users as AuthUser[];
  } catch (error) {
    addNotice(notices, "Auth users", error);
    return [] as AuthUser[];
  }
}

async function loadCore(context: AdminContext, notices: AdminNotice[]) {
  const authUsers = await listAuthUsers(context, notices);
  const [profiles, tenants, memberships, customers, subscriptions, integrations] =
    await Promise.all([
      safeRows<ProfileRow>(
        notices,
        "User profiles",
        context.admin
          .from("user_profiles")
          .select("user_id, email, full_name, is_admin, created_at")
          .order("created_at", { ascending: false }),
      ),
      safeRows<TenantRow>(
        notices,
        "Organizations",
        context.admin
          .from("tenants")
          .select("id, name, created_by, created_at")
          .order("created_at", { ascending: false }),
      ),
      safeRows<MembershipRow>(
        notices,
        "Tenant memberships",
        context.admin.from("tenant_memberships").select("tenant_id, user_id, role"),
      ),
      safeRows<BillingCustomerRow>(
        notices,
        "Billing customers",
        context.admin.from("billing_customers").select("tenant_id, stripe_customer_id"),
      ),
      safeRows<BillingSubscriptionRow>(
        notices,
        "Billing subscriptions",
        context.admin
          .from("billing_subscriptions")
          .select(
            "tenant_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_end",
          )
          .order("created_at", { ascending: false }),
      ),
      safeRows<TenantIntegrationRow>(
        notices,
        "Integrations",
        context.admin.from("tenant_integrations").select("tenant_id, provider, status"),
      ),
    ]);

  return {
    authUsers,
    profiles,
    tenants,
    memberships,
    customers,
    subscriptions,
    integrations,
  };
}

function makeProfileMap(profiles: ProfileRow[]) {
  return new Map(profiles.map((profile) => [profile.user_id, profile]));
}

function makeTenantMap(tenants: TenantRow[]) {
  return new Map(tenants.map((tenant) => [tenant.id, tenant]));
}

function makeSubscriptionMap(subscriptions: BillingSubscriptionRow[]) {
  const map = new Map<string, BillingSubscriptionRow>();
  for (const subscription of subscriptions) {
    if (!map.has(subscription.tenant_id)) map.set(subscription.tenant_id, subscription);
  }
  return map;
}

function tenantNamesForUser(userId: string, memberships: MembershipRow[], tenants: TenantRow[]) {
  const tenantsById = makeTenantMap(tenants);
  return memberships
    .filter((membership) => membership.user_id === userId)
    .map((membership) => tenantsById.get(membership.tenant_id)?.name)
    .filter((name): name is string => Boolean(name));
}

function roleForUser(userId: string, memberships: MembershipRow[], profiles: ProfileRow[]) {
  if (profiles.some((profile) => profile.user_id === userId && profile.is_admin)) {
    return "admin";
  }

  const roles = memberships
    .filter((membership) => membership.user_id === userId)
    .map((membership) => membership.role);

  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "tenant admin";
  return roles[0] ?? "user";
}

function metadataPreview(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const text = JSON.stringify(value);
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function firstSubscriptionStatusForUser(
  userId: string,
  memberships: MembershipRow[],
  subscriptionsByTenant: Map<string, BillingSubscriptionRow>,
) {
  for (const membership of memberships) {
    if (membership.user_id !== userId) continue;
    const status = subscriptionsByTenant.get(membership.tenant_id)?.status;
    if (status) return status;
  }
  return null;
}

export async function getAdminUsers(context: AdminContext) {
  const notices: AdminNotice[] = [];
  const core = await loadCore(context, notices);
  const profilesByUserId = makeProfileMap(core.profiles);
  const subscriptionsByTenant = makeSubscriptionMap(core.subscriptions);

  const users = core.authUsers
    .map((user) => {
      const profile = profilesByUserId.get(user.id);

      return {
        userId: user.id,
        email: profile?.email ?? user.email ?? "No email",
        fullName: profile?.full_name ?? null,
        role: roleForUser(user.id, core.memberships, core.profiles),
        createdAt: user.created_at ?? profile?.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        tenantNames: tenantNamesForUser(user.id, core.memberships, core.tenants),
        subscriptionStatus: firstSubscriptionStatusForUser(
          user.id,
          core.memberships,
          subscriptionsByTenant,
        ),
      };
    })
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  return { users, notices };
}

export async function getAdminOrgs(context: AdminContext) {
  const notices: AdminNotice[] = [];
  const core = await loadCore(context, notices);
  const profilesByUserId = makeProfileMap(core.profiles);
  const subscriptionsByTenant = makeSubscriptionMap(core.subscriptions);

  const orgs = core.tenants.map((tenant) => {
    const members = core.memberships.filter((membership) => membership.tenant_id === tenant.id);
    const ownerMembership = members.find((membership) => membership.role === "owner");
    const ownerId = ownerMembership?.user_id ?? tenant.created_by ?? null;
    const subscription = subscriptionsByTenant.get(tenant.id);
    const integrations = core.integrations.filter((integration) => integration.tenant_id === tenant.id);
    const activeIntegrations = integrations.filter((integration) => integration.status === "active").length;

    return {
      tenantId: tenant.id,
      name: tenant.name,
      ownerEmail: ownerId ? profilesByUserId.get(ownerId)?.email ?? null : null,
      plan: subscription?.stripe_price_id ?? null,
      createdAt: tenant.created_at ?? null,
      memberCount: members.length,
      integrationStatus: integrations.length ? `${activeIntegrations}/${integrations.length} active` : "None",
    };
  });

  return { orgs, notices };
}

export async function getAdminBilling(context: AdminContext) {
  const notices: AdminNotice[] = [];
  const core = await loadCore(context, notices);
  const tenantsById = makeTenantMap(core.tenants);
  const profilesByUserId = makeProfileMap(core.profiles);
  const ownersByTenant = new Map<string, string | null>();

  for (const tenant of core.tenants) {
    const owner = core.memberships.find(
      (membership) => membership.tenant_id === tenant.id && membership.role === "owner",
    );
    ownersByTenant.set(tenant.id, owner ? profilesByUserId.get(owner.user_id)?.email ?? null : null);
  }

  const billing = core.subscriptions.map((subscription) => {
    const tenant = tenantsById.get(subscription.tenant_id);

    return {
      tenantName: tenant?.name ?? null,
      customerEmail: ownersByTenant.get(subscription.tenant_id) ?? null,
      plan: subscription.stripe_price_id,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      stripeCustomerId: subscription.stripe_customer_id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    };
  });

  return { billing, notices };
}

export async function getWebhookEvents(context: AdminContext) {
  const notices: AdminNotice[] = [];
  const events = await safeRows<WebhookEventRawRow>(
    notices,
    "Webhook events",
    context.admin
      .from("webhook_events")
      .select("id, provider, event_type, status, created_at, error")
      .order("created_at", { ascending: false })
      .limit(100),
  );

  return {
    events: events.map((event) => ({
      id: event.id,
      provider: event.provider,
      eventType: event.event_type,
      status: event.status,
      createdAt: event.created_at,
      errorMessage: event.error,
    })),
    notices,
  };
}

export async function getAuditEvents(context: AdminContext) {
  const notices: AdminNotice[] = [];
  const adminAuditRows = await safeRows<AuditEventRawRow>(
    notices,
    "Admin audit log",
    context.admin
      .from("admin_audit_log")
      .select("id, actor_user_id, action, target_type, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  );

  const auditRows = adminAuditRows.length
    ? adminAuditRows
    : await safeRows<AuditEventRawRow>(
        notices,
        "Audit events",
        context.admin
          .from("audit_events")
          .select("id, actor_user_id, event_type, target_type, target_id, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      );

  const actorIds = Array.from(
    new Set(auditRows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id))),
  );
  const actorProfiles = actorIds.length
    ? await safeRows<ProfileRow>(
        notices,
        "Audit actors",
        context.admin
          .from("user_profiles")
          .select("user_id, email, full_name")
          .in("user_id", actorIds),
      )
    : [];
  const actorsByUserId = makeProfileMap(actorProfiles);

  return {
    events: auditRows.map((event) => ({
      id: event.id,
      actor: event.actor_user_id
        ? actorsByUserId.get(event.actor_user_id)?.email ?? event.actor_user_id.slice(0, 8)
        : null,
      action: event.action ?? event.event_type ?? "event",
      target: [event.target_type, event.target_id].filter(Boolean).join(": ") || null,
      createdAt: event.created_at,
      metadataPreview: metadataPreview(event.metadata),
    })),
    notices,
  };
}

export async function getAdminOverview(context: AdminContext): Promise<AdminOverview> {
  const notices: AdminNotice[] = [];
  const [totalUsers, totalTenants, activeSubscriptions, recentWebhookEvents, recentAuditEvents, users] =
    await Promise.all([
      safeCount(
        notices,
        "User count",
        context.admin.from("user_profiles").select("*", { count: "exact", head: true }),
      ),
      safeCount(
        notices,
        "Organization count",
        context.admin.from("tenants").select("*", { count: "exact", head: true }),
      ),
      safeCount(
        notices,
        "Active subscriptions",
        context.admin
          .from("billing_subscriptions")
          .select("*", { count: "exact", head: true })
          .in("status", ["active", "trialing"]),
      ),
      getWebhookEvents(context),
      getAuditEvents(context),
      getAdminUsers(context),
    ]);

  return {
    notices: [
      ...notices,
      ...recentWebhookEvents.notices,
      ...recentAuditEvents.notices,
      ...users.notices,
    ],
    totalUsers,
    totalTenants,
    activeSubscriptions,
    recentSignups: users.users.slice(0, 8),
    recentWebhookEvents: recentWebhookEvents.events.slice(0, 8),
    recentAuditEvents: recentAuditEvents.events.slice(0, 8),
  };
}
