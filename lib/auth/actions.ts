"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearActiveTenantId } from "@/lib/auth/active-tenant";
import {
  appendAuthRedirect,
  readAuthRedirectFormValue,
  sanitizeAuthRedirect,
} from "@/lib/auth/redirects";
import {
  keepSignedInCookieName,
  keepSignedInCookieOptions,
  readKeepSignedInFormValue,
} from "@/lib/auth/remember-me";
import { isValidEmailAddress, sendTenantEmail } from "@/lib/email/send";
import {
  escapeEmailHtml,
  productEmailSubject,
  productEmailText,
} from "@/lib/email/templates";
import { getRequestIp } from "@/lib/request/ip";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/urls/app";
import { getOptionalServerEnv } from "@/lib/env/server";
import { getStripeBasicPriceId } from "@/lib/billing/prices";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function redirectWith(path: string, key: "error" | "message", value: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${key}=${encodeURIComponent(value)}`);
}

function withNext(path: string, next: string, fallback: string) {
  return appendAuthRedirect(path, next, fallback);
}

function withQueryParam(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function safeNextPath(value: string, fallback: string) {
  return sanitizeAuthRedirect(value, fallback);
}

const passwordPolicyMessage =
  "Password must include: 8+ length, uppercase letter, lowercase letter, number, and symbol.";

function validatePasswordPolicy(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function isExistingAccountError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("already") && normalized.includes("registered");
}

const loginMismatchMessage =
  "Email or password did not match. Try again or reset your password.";

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
  try {
    return getStripeBasicPriceId();
  } catch {
    return null;
  }
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveEmailTenant(email: string) {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("email", email)
    .limit(1);
  const userId = profiles?.[0]?.user_id ?? null;

  if (!userId) {
    return {
      userId: null,
      tenantId: null,
    };
  }

  const { data: memberships } = await admin
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  return {
    userId,
    tenantId: memberships?.[0]?.tenant_id ?? null,
  };
}

function readTenantName(
  tenants:
    | {
        name?: string | null;
      }
    | {
        name?: string | null;
      }[]
    | null,
) {
  const tenant = Array.isArray(tenants) ? tenants[0] : tenants;
  return tenant?.name ?? "this workspace";
}

async function resendPendingInvitationForEmail(email: string) {
  const admin = createAdminClient();
  const { data: invitations, error: invitationReadError } = await admin
    .from("tenant_invitations")
    .select("id, tenant_id, email, role, invited_by_user_id, tenants(name)")
    .eq("email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (invitationReadError) {
    return {
      found: false,
      ok: false,
      error: invitationReadError.message,
    };
  }

  const invitation = invitations?.[0] ?? null;
  if (!invitation) {
    return {
      found: false,
      ok: true,
      error: null,
    };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tenantName = readTenantName(invitation.tenants);

  const { error: updateError } = await admin
    .from("tenant_invitations")
    .update({
      token_hash: hashInvitationToken(token),
      expires_at: expiresAt,
      email_delivery_status: "queued",
      email_delivery_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id)
    .eq("status", "pending");

  if (updateError) {
    return {
      found: true,
      ok: false,
      error: updateError.message,
    };
  }

  const inviteUrl = `${await getAppBaseUrl()}/settings/team/accept?token=${encodeURIComponent(token)}`;
  const safeTenantName = escapeEmailHtml(tenantName);
  const safeInviteUrl = escapeEmailHtml(inviteUrl);
  const subject = productEmailSubject("team_invited");
  const text = productEmailText(
    "team_invited",
    `Accept the invitation here: ${inviteUrl}`,
  );
  const html = `
    <p>You were invited to join <strong>${safeTenantName}</strong> in HyperOptimal Metrics.</p>
    <p><a href="${safeInviteUrl}">Accept invitation</a></p>
  `;
  const result = await sendTenantEmail({
    tenantId: invitation.tenant_id,
    actorUserId: invitation.invited_by_user_id,
    to: [email],
    subject,
    text,
    html,
    template: "team_invited",
    metadata: {
      resentFromPasswordReset: true,
      role: invitation.role,
    },
  });

  await admin
    .from("tenant_invitations")
    .update({
      email_delivery_status: result.ok ? "sent" : "failed",
      email_delivery_error: result.error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  await logAuditEvent({
    tenantId: invitation.tenant_id,
    actorUserId: invitation.invited_by_user_id,
    eventType: result.ok
      ? "team_invitation_email_resent"
      : "team_invitation_email_failed",
    targetType: "tenant_invitation",
    targetId: invitation.id,
    metadata: {
      email,
      source: "forgot_password",
      error: result.error,
    },
  });

  return {
    found: true,
    ok: result.ok,
    error: result.error,
  };
}

async function sendPasswordResetEmail(email: string, next: string) {
  const admin = createAdminClient();
  const origin = await getAppBaseUrl();
  const redirectTo = withNext(`${origin}/auth/hash-callback`, next, "/dashboard");
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo,
    },
  });

  if (error) {
    const invitationResult = await resendPendingInvitationForEmail(email);

    if (invitationResult.found) {
      return {
        ok: invitationResult.ok,
        skipped: false,
        error: invitationResult.error,
      };
    }

    await logAuditEvent({
      eventType: "password_reset_requested_failed",
      targetType: "auth_user",
      metadata: {
        email,
        error: error.message,
      },
    });
    return {
      ok: true,
      skipped: true,
      error: null,
    };
  }

  const resetUrl = data.properties?.action_link;
  if (!resetUrl) {
    return {
      ok: false,
      skipped: false,
      error: "Password reset link could not be created.",
    };
  }

  const recipient = await resolveEmailTenant(email);
  const safeResetUrl = escapeEmailHtml(resetUrl);
  const subject = productEmailSubject("password_reset");
  const text = productEmailText(
    "password_reset",
    `Reset your password here: ${resetUrl}`,
  );
  const html = `
    <p>Use this secure link to reset your HyperOptimal Metrics password.</p>
    <p><a href="${safeResetUrl}">Reset password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  const result = await sendTenantEmail({
    tenantId: recipient.tenantId,
    actorUserId: recipient.userId,
    to: [email],
    subject,
    text,
    html,
    template: "password_reset",
    metadata: {
      authEmail: true,
    },
  });

  return {
    ok: result.ok,
    skipped: false,
    error: result.error,
  };
}

async function checkAuthRateLimit(
  action: string,
  email: string | null,
  redirectPath: string,
  limit = 5,
  windowSeconds = 600,
) {
  const ip = await getRequestIp();
  const result = await checkRateLimit({
    route: `auth:${action}`,
    key: `${ip}:${email ?? "unknown"}`,
    limit,
    windowSeconds,
    metadata: {
      action,
      email: email ?? null,
    },
  });

  if (!result.allowed) {
    redirectWith(
      redirectPath,
      "error",
      action === "forgot_password"
        ? "Too many password reset requests. Please wait and try again."
        : action === "login"
          ? "Too many login attempts. Please wait and try again."
          : "Too many attempts. Please wait and try again.",
    );
  }
}

export async function signUpAction(formData: FormData) {
  const email = normalizeEmail(formValue(formData, "email"));
  const password = formValue(formData, "password");
  const confirmPassword = formValue(formData, "confirmPassword");
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const organizationName = formValue(formData, "organizationName");
  const next = readAuthRedirectFormValue(formData, "/get-started");
  const isInviteFlow = next.startsWith("/settings/team/accept");

  if (!isValidEmailAddress(email) || !password || (!organizationName && !isInviteFlow)) {
    redirectWith(
      withNext("/signup", next, "/get-started"),
      "error",
      isInviteFlow
        ? "Please enter a valid email address."
        : "Organization, valid email, and password are required.",
    );
  }

  if (!validatePasswordPolicy(password)) {
    redirectWith(
      withNext("/signup", next, "/get-started"),
      "error",
      passwordPolicyMessage,
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
      emailRedirectTo: `${await getAppBaseUrl()}/auth/callback?redirect=${encodeURIComponent(next)}`,
      data: {
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName || null,
        organization_name: organizationName || null,
        onboarding_organization_name: organizationName || null,
        onboarding_bootstrap_status: isInviteFlow ? "invite" : "pending",
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
    if (isInviteFlow && isExistingAccountError(error.message)) {
      redirectWith(
        withNext("/login", next, "/dashboard"),
        "message",
        "That account already exists. Log in to accept the invitation.",
      );
    }
    redirectWith(
      withNext("/signup", next, "/get-started"),
      "error",
      isExistingAccountError(error.message)
        ? "An account with this email already exists. Please sign in instead."
        : error.message,
    );
  }

  await logAuditEvent({
    actorUserId: data.user?.id ?? null,
    eventType: "signup",
    targetType: "auth_user",
    targetId: data.user?.id ?? null,
    metadata: {
      email,
      organizationName: organizationName || null,
      requiresConfirmation: !data.session,
    },
  });

  if (data.session) {
    redirect(next);
  }

  const signupSuccessParams = new URLSearchParams({
    success: "1",
    email,
  });
  if (next !== "/get-started") {
    signupSuccessParams.set("redirect", next);
  }
  redirect(`/signup?${signupSuccessParams.toString()}`);
}

export async function signInAction(formData: FormData) {
  const email = normalizeEmail(formValue(formData, "email"));
  const password = formValue(formData, "password");
  const keepSignedIn = readKeepSignedInFormValue(formData);
  const next = readAuthRedirectFormValue(formData, "/dashboard");

  if (!isValidEmailAddress(email) || !password) {
    redirectWith(
      withNext("/login", next, "/dashboard"),
      "error",
      isValidEmailAddress(email)
        ? loginMismatchMessage
        : "Please enter a valid email address.",
    );
  }

  await checkAuthRateLimit("login", email, withNext("/login", next, "/dashboard"), 10, 60);

  const supabase = await createClient({ keepSignedIn });
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
    const normalizedError = error.message.toLowerCase();
    redirectWith(
      withNext("/login", next, "/dashboard"),
      "error",
      normalizedError.includes("email") && normalizedError.includes("confirm")
        ? "Please verify your email before signing in."
        : loginMismatchMessage,
    );
  }

  await logAuditEvent({
    actorUserId: data.user?.id ?? null,
    eventType: "login",
    targetType: "auth_user",
    targetId: data.user?.id ?? null,
    metadata: {
      email,
      keepSignedIn,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(
    keepSignedInCookieName,
    keepSignedIn ? "1" : "0",
    keepSignedInCookieOptions(keepSignedIn),
  );

  redirect(next);
}

export async function signOutAction(formData?: FormData) {
  const next =
    formData instanceof FormData
      ? safeNextPath(formValue(formData, "next"), "/login")
      : "/login";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  await clearActiveTenantId();
  const cookieStore = await cookies();
  cookieStore.delete(keepSignedInCookieName);
  await logAuditEvent({
    actorUserId: user?.id ?? null,
    eventType: "logout",
    targetType: "auth_user",
    targetId: user?.id ?? null,
  });
  redirectWith(next, "message", "You have been signed out.");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = normalizeEmail(formValue(formData, "email"));
  const next = readAuthRedirectFormValue(formData, "/dashboard");
  const forgotPasswordPath = withNext("/forgot-password", next, "/dashboard");

  if (!isValidEmailAddress(email)) {
    redirectWith(forgotPasswordPath, "error", "Please enter a valid email address.");
  }

  await checkAuthRateLimit("forgot_password", email, forgotPasswordPath, 3, 60);

  const result = await sendPasswordResetEmail(email, next);

  if (!result.ok) {
    await logAuditEvent({
      eventType: "password_reset_requested_failed",
      targetType: "auth_user",
      metadata: {
        email,
        error: result.error,
      },
    });
    redirectWith(
      forgotPasswordPath,
      "error",
      "Password reset email could not be sent. Try again in a few minutes.",
    );
  }

  await logAuditEvent({
    eventType: "password_reset_requested",
    targetType: "auth_user",
    metadata: {
      email,
    },
  });

  const messagePath = withQueryParam(
    forgotPasswordPath,
    "message",
    `If an account exists for ${email}, we've sent a password reset link. Click the link to continue.`,
  );
  redirect(withQueryParam(messagePath, "email", email));
}

export async function updatePasswordAction(formData: FormData) {
  const password = formValue(formData, "password");
  const confirmPassword = formValue(formData, "confirmPassword");
  const next = readAuthRedirectFormValue(formData, "/dashboard");
  const resetPasswordPath = withNext("/reset-password", next, "/dashboard");

  if (!password) {
    redirectWith(resetPasswordPath, "error", "New password is required.");
  }

  if (!validatePasswordPolicy(password)) {
    redirectWith(resetPasswordPath, "error", passwordPolicyMessage);
  }

  if (confirmPassword && password !== confirmPassword) {
    redirectWith(resetPasswordPath, "error", "Passwords must match.");
  }

  await checkAuthRateLimit("reset_password", null, resetPasswordPath);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWith(
      withNext("/forgot-password", next, "/dashboard"),
      "error",
      "Reset link expired. Request a new one.",
    );
  }

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
    redirectWith(resetPasswordPath, "error", error.message);
  }

  await logAuditEvent({
    actorUserId: user?.id ?? null,
    eventType: "password_updated",
    targetType: "auth_user",
    targetId: user?.id ?? null,
  });

  await supabase.auth.signOut();
  await clearActiveTenantId();
  redirectWith(
    withNext("/login", next, "/dashboard"),
    "message",
    "Password updated! Your password has been successfully reset. Sign in to continue.",
  );
}

export async function createTenantAction(formData: FormData) {
  const name = formValue(formData, "name");

  if (!name) {
    redirectWith("/get-started", "error", "Company name is required.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirectWith("/login", "error", "Log in to create an account.");
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

  redirectWith("/get-started", "message", "Account created.");
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

  redirectWith("/dashboard", "message", "Setup skipped.");
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
      "Create an account before starting billing.",
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

  if (!getOptionalServerEnv("STRIPE_SECRET_KEY") || !onboardingPriceId) {
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
      "Billing checkout is not available right now.",
    );
  }

  const admin = createAdminClient();
  const stripe = createStripeClient();
  const origin = await getAppBaseUrl();
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
