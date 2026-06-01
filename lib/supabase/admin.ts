import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getRequiredServerEnv } from "@/lib/env/server";
import { getRequiredPublicEnv } from "@/lib/env/public";

export function createAdminClient() {
  const supabaseUrl = getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}
