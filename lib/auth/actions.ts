"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequestIp } from "@/lib/request/ip";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWith(path: string, key: "error" | "message", value: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${key}=${encodeURIComponent(value)}`);
}

function withNext(path: string, next: string, fallback: string) {
  if (next === fallback) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(next)}`;
}

function safeNextPath(value: string, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function getMembershipTenant(
  membership:
    | {
        tenant_id: string;
        tenants:
          | {
              id: string;
              name: string;
            }
          | {
              id: string;
              name: string;
            }[]
          | null;
      }
    | undefined,
) {
  const tenant = Array.isArray(membership?.tenants)
    ? membership.tenants[0]
    : membership?.tenants;

  if (!membership || !tenant) {
    return null;
  }

  return {
    id: tenant.id,
    name: tenant.name,
    membershipTenantId: membership.tenant_id,
  };
}

function getStripeOnboardingPriceId() {
  return process.env.STRIPE_ONBOARDING_PRICE_ID ?? process.env.STRIPE_PRICE_ID;
}

async function getOrigin() {
  return (
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

async function checkAuthRateLimit(
  action: string,
  email: string | null,
  redirectPath: string,
) {
  const ip = await getRequestIp();
  const result = await checkRateLimit({
    route: `auth:${action}`,
    key: `${ip}:${email ?? "unknown"}`,
    limit: 5,
    windowSeconds: 600,
    metadata: {
      action,
      email: email ?? null,
    },
  });

  if (!result.allowed) {
    redirectWith(
      redirectPath,
      "error",
      "Too many attempts. Try again later.",
    );
  }
}

export async function signUpAction(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const confirmPassword = formValue(formData, "confirmPassword");
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const organizationName = formValue(formData, "organizationName");
  const next = safeNextPath(formValue(formData, "next"), "/get-started");

  if (!email || !password || !organizationName) {
    redirectWith(
      withNext("/signup", next, "/get-started"),
      "error",
      "Organization, email, and password are required.",
    );
  }

  if (confirmPassword && password !== confirmPassword) {
    redirectWith(
      withNext("/signup", next, "/get-started"),
      "error",
      "Passwords must match.",
    );
  }

  await checkAuthRateLimit("signup", email, withNext("/signup", next, "/get-started"));

  const supabase = await createClient();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName || null,
        organization_name: organizationName,
      },
    },
  });

  if (error) {
    await logAuditEvent({
      eventType: "signup_failed",
      targetType: "auth_user",
      metadata: {
        email,
        error: error.message,
      },
    });
    redirectWith(withNext("/signup", next, "/get-started"), "error", error.message);
  }

  await logAuditEvent({
    actorUserId: data.user?.id ?? null,
    eventType: "signup",
    targetType: "auth_user",
    targetId: data.user?.id ?? null,
    metadata: {
      email,
      organizationName,
      requiresConfirmation: !data.session,
    },
  });

  if (data.session) {
    redirect(next);
  }

  redirectWith(
    withNext("/login", next, "/dashboard"),
    "message",
    "Account created. Check your email if confirmation is required, then log in.",
  );
}

export async function signInAction(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const next = safeNextPath(formValue(formData, "next"), "/dashboard");

  if (!email || !password) {
    redirectWith(
      withNext("/login", next, "/dashboard"),
      "error",
      "Email and password are required.",
    );
  }

  await checkAuthRateLimit("login", email, withNext("/login", next, "/dashboard"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await logAuditEvent({
      eventType: "login_failed",
      targetType: "auth_user",
      metadata: {
        email,
        error: error.message,
      },
    });
    redirectWith(withNext("/login", next, "/dashboard"), "error", error.message);
  }

  await logAuditEvent({
    actorUserId: data.user?.id ?? null,
    eventType: "login",
    targetType: "auth_user",
    targetId: data.user?.id ?? null,
    metadata: {
      email,
    },
  });

  redirect(next);
}

export async function signOutAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  await logAuditEvent({
    actorUserId: user?.id ?? null,
    eventType: "logout",
    targetType: "auth_user",
    targetId: user?.id ?? null,
  });
  redirectWith("/login", "message", "You have been signed out.");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = formValue(formData, "email");

  if (!email) {
    redirectWith("/forgot-password", "error", "Email is required.");
  }

  await checkAuthRateLimit("forgot_password", email, "/forgot-password");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getOrigin()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    await logAuditEvent({
      eventType: "password_reset_requested_failed",
      targetType: "auth_user",
      metadata: {
        email,
        error: error.message,
      },
    });
    redirectWith("/forgot-password", "error", error.message);
  }

  await logAuditEvent({
    eventType: "password_reset_requested",
    targetType: "auth_user",
    metadata: {
      email,
    },
  });

  redirectWith(
    "/forgot-password",
    "message",
    "If that email exists, a reset link has been sent.",
  );
}

export async function updatePasswordAction(formData: FormData) {
  const password = formValue(formData, "password");

  if (!password) {
    redirectWith("/reset-password", "error", "New password is required.");
  }

  await checkAuthRateLimit("reset_password", null, "/reset-password");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    await logAuditEvent({
      actorUserId: user?.id ?? null,
      eventType: "password_update_failed",
      targetType: "auth_user",
      targetId: user?.id ?? null,
      metadata: {
        error: error.message,
      },
    });
    redirectWith("/reset-password", "error", error.message);
  }

  await logAuditEvent({
    actorUserId: user?.id ?? null,
    eventType: "password_updated",
    targetType: "auth_user",
    targetId: user?.id ?? null,
  });

  redirectWith("/dashboard", "message", "Password updated.");
}

export async function createTenantAction(formData: FormData) {
  const name = formValue(formData, "name");

  if (!name) {
    redirectWith("/get-started", "error", "Workspace name is required.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirectWith("/login", "error", "Log in to create a workspace.");
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({
      name,
      created_by: user.id,
    })
    .select("id, name")
    .single();

  if (error) {
    await logAuditEvent({
      actorUserId: user.id,
      eventType: "workspace_create_failed",
      targetType: "tenant",
      metadata: {
        name,
        error: error.message,
      },
    });
    redirectWith("/get-started", "error", error.message);
  }

  await logAuditEvent({
    tenantId: tenant.id,
    actorUserId: user.id,
    eventType: "workspace_created",
    targetType: "tenant",
    targetId: tenant.id,
    metadata: {
      name: tenant.name,
    },
  });

  redirectWith("/get-started", "message", "Workspace created.");
}

export async function skipOnboardingAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirectWith("/login", "error", "Log in to continue.");
  }

  await logAuditEvent({
    actorUserId: user.id,
    eventType: "onboarding_skipped",
    targetType: "auth_user",
    targetId: user.id,
  });

  redirectWith("/dashboard", "message", "Workspace setup skipped.");
}

export async function startStripeCheckoutAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirectWith("/login", "error", "Log in to continue.");
  }

  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenants(id, name)")
    .order("created_at", { ascending: true })
    .limit(1);
  const tenant = getMembershipTenant(memberships?.[0]);

  if (!tenant) {
    redirectWith(
      "/get-started",
      "error",
      "Create a workspace before starting billing.",
    );
  }

  const limit = await checkRateLimit({
    route: "billing:checkout",
    key: `${tenant.id}:${user.id}`,
    limit: 10,
    windowSeconds: 600,
    tenantId: tenant.id,
    actorUserId: user.id,
  });

  if (!limit.allowed) {
    redirectWith(
      "/get-started",
      "error",
      "Too many checkout attempts. Try again later.",
    );
  }

  const onboardingPriceId = getStripeOnboardingPriceId();

  if (!process.env.STRIPE_SECRET_KEY || !onboardingPriceId) {
    await logAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: "stripe_checkout_placeholder",
      targetType: "tenant",
      targetId: tenant.id,
      metadata: {
        reason: "stripe_env_not_configured",
      },
    });
    redirectWith(
      "/get-started",
      "message",
      "Stripe checkout is ready for configuration.",
    );
  }

  const admin = createAdminClient();
  const stripe = createStripeClient();
  const origin = await getOrigin();
  const { data: existingCustomer } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  let stripeCustomerId = existingCustomer?.stripe_customer_id as
    | string
    | undefined;

  let checkoutUrl: string | null = null;

  try {
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: tenant.name,
        metadata: {
          tenant_id: tenant.id,
          created_by: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await admin.from("billing_customers").upsert({
        tenant_id: tenant.id,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: onboardingPriceId,
          quantity: 1,
        },
      ],
      client_reference_id: tenant.id,
      success_url: `${origin}/get-started?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/get-started?billing=cancelled`,
      metadata: {
        tenant_id: tenant.id,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenant.id,
          user_id: user.id,
        },
      },
    });

    await logAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: "stripe_checkout_started",
      targetType: "tenant",
      targetId: tenant.id,
      metadata: {
        checkoutSessionId: session.id,
      },
    });

    checkoutUrl = session.url;

    if (!checkoutUrl) {
      throw new Error("Stripe did not return a checkout URL.");
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe checkout failed.";
    await logAuditEvent({
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: "stripe_checkout_failed",
      targetType: "tenant",
      targetId: tenant.id,
      metadata: {
        error: message,
      },
    });
    redirectWith("/get-started", "error", message);
  }

  redirect(checkoutUrl);
}
