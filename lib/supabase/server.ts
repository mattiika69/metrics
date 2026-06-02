import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  authCookieOptionsForPreference,
  keepSignedInCookieName,
  shouldKeepSignedIn,
} from "@/lib/auth/remember-me";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function createClient(options?: { keepSignedIn?: boolean }) {
  const cookieStore = await cookies();
  const keepSignedIn = shouldKeepSignedIn(
    cookieStore.get(keepSignedInCookieName)?.value,
    options?.keepSignedIn,
  );

  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(
                name,
                value,
                authCookieOptionsForPreference(options, keepSignedIn),
              );
            });
          } catch {
            // Server Components cannot set cookies directly.
          }
        },
      },
    },
  );
}
