import {
  getRequiredOneOfPublicEnv,
  getRequiredPublicEnv,
} from "@/lib/env/public";

export function getSupabaseUrl() {
  return getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  return getRequiredOneOfPublicEnv([
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]);
}
