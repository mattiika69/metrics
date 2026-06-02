import "server-only";

import type { CookieOptions } from "@supabase/ssr";

export const keepSignedInCookieName = "hom_keep_signed_in";
export const persistentAuthCookieMaxAge = 400 * 24 * 60 * 60;

export function readKeepSignedInFormValue(formData: FormData) {
  return formData.get("keepSignedIn") === "on";
}

export function keepSignedInCookieOptions(keepSignedIn: boolean) {
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  return keepSignedIn
    ? { ...base, maxAge: persistentAuthCookieMaxAge }
    : base;
}

export function shouldKeepSignedIn(
  cookieValue: string | undefined,
  explicitPreference?: boolean,
) {
  return explicitPreference ?? cookieValue !== "0";
}

export function authCookieOptionsForPreference(
  options: CookieOptions,
  keepSignedIn: boolean,
) {
  if (keepSignedIn) return options;

  const sessionOptions = { ...options };
  delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}
