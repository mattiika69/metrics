import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("content-security-policy", "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'");
  response.headers.set("cross-origin-opener-policy", "same-origin");
  response.headers.set("cross-origin-resource-policy", "same-origin");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("x-dns-prefetch-control", "off");
  response.headers.set("x-download-options", "noopen");
  response.headers.set("x-permitted-cross-domain-policies", "none");
  response.headers.set(
    "strict-transport-security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );

  return response;
}

export async function middleware(request: NextRequest) {
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !publishableKey
  ) {
    return withSecurityHeaders(NextResponse.next({ request }));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();

  return withSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
