"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequestIp } from "@/lib/request/ip";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWith(path: string, key: "error" | "message", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
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

  if (!email || !password) {
    redirectWith("/signup", "error", "Email and password are required.");
  }

  await checkAuthRateLimit("signup", email, "/signup");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=/onboarding`,
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
    redirectWith("/signup", "error", error.message);
  }

  await logAuditEvent({
    actorUserId: data.user?.id ?? null,
    eventType: "signup",
    targetType: "auth_user",
    targetId: data.user?.id ?? null,
    metadata: {
      email,
      requiresConfirmation: !data.session,
    },
  });

  if (data.session) {
    redirect("/onboarding");
  }

  redirectWith(
    "/login",
    "message",
    "Account created. Check your email if confirmation is required, then log in.",
  );
}

export async function signInAction(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  if (!email || !password) {
    redirectWith("/login", "error", "Email and password are required.");
  }

  await checkAuthRateLimit("login", email, "/login");

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
    redirectWith("/login", "error", error.message);
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

  redirect("/dashboard");
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
    redirectWith("/onboarding", "error", "Workspace name is required.");
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
    redirectWith("/onboarding", "error", error.message);
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

  redirectWith("/dashboard", "message", "Workspace created.");
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
