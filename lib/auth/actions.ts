"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

export async function signUpAction(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  if (!email || !password) {
    redirectWith("/signup", "error", "Email and password are required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    redirectWith("/signup", "error", error.message);
  }

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWith("/login", "error", error.message);
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirectWith("/login", "message", "You have been signed out.");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = formValue(formData, "email");

  if (!email) {
    redirectWith("/forgot-password", "error", "Email is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getOrigin()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirectWith("/forgot-password", "error", error.message);
  }

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

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirectWith("/reset-password", "error", error.message);
  }

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

  const { error } = await supabase.from("tenants").insert({
    name,
    created_by: user.id,
  });

  if (error) {
    redirectWith("/onboarding", "error", error.message);
  }

  redirectWith("/dashboard", "message", "Workspace created.");
}
