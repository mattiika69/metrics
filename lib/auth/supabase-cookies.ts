import "server-only";

import { cookies } from "next/headers";

const supabaseAuthCookiePattern = /^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/i;

export async function clearSupabaseAuthCookieArtifacts() {
  const cookieStore = await cookies();
  const authCookieNames = new Set(
    cookieStore
      .getAll()
      .map((cookie) => cookie.name)
      .filter((name) => supabaseAuthCookiePattern.test(name)),
  );

  for (const name of authCookieNames) {
    cookieStore.delete(name);
    cookieStore.set(name, "", {
      maxAge: 0,
      path: "/",
    });

    try {
      cookieStore.set(name, "", {
        domain: ".scalingmetrics.com",
        maxAge: 0,
        path: "/",
      });
    } catch {
      // Local development hosts cannot set the production parent domain.
    }
  }
}
