import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

const DEFAULT_ADMIN_EMAILS = ["matt@1000xleads.com"];

export type AdminProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
};

export type AdminContext = {
  admin: ReturnType<typeof createAdminClient>;
  user: {
    id: string;
    email?: string | null;
  };
  profile: AdminProfile;
};

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function allowedAdminEmails() {
  const configured = process.env.ADMIN_EMAILS;
  const source = configured
    ? configured.split(",")
    : DEFAULT_ADMIN_EMAILS;

  return new Set(
    source
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

function isAllowedGlobalAdmin({
  user,
  profile,
}: {
  user: { id: string; email?: string | null };
  profile: AdminProfile;
}) {
  if (!profile.is_admin || profile.user_id !== user.id) return false;

  const allowed = allowedAdminEmails();
  const userEmail = normalizeEmail(user.email);
  const profileEmail = normalizeEmail(profile.email);

  return allowed.has(userEmail) || allowed.has(profileEmail);
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

async function loadAdminContext(user: { id: string; email?: string | null }) {
  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("user_profiles")
      .select("user_id, email, full_name, is_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !profile) return null;

    const typedProfile = profile as AdminProfile;
    if (!isAllowedGlobalAdmin({ user, profile: typedProfile })) return null;

    return {
      admin,
      user,
      profile: typedProfile,
    };
  } catch {
    return null;
  }
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  return loadAdminContext(user);
}

export async function requireAdmin() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const context = await loadAdminContext(user);
  if (!context) redirect("/dashboard");

  return context;
}

export async function requireAdminApi(): Promise<AdminContext | Response> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const context = await loadAdminContext(user);
  if (!context) {
    return Response.json({ error: "Admin access is required." }, { status: 403 });
  }

  return context;
}
