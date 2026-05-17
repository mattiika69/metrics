import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

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

    if (error || !profile?.is_admin) return null;

    return {
      admin,
      user,
      profile: profile as AdminProfile,
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
