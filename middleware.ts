import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { authRedirectParam } from "@/lib/auth/redirects";

const PROTECTED_PAGE_PREFIXES = [
  "/account",
  "/admin",
  "/benchmarks",
  "/billing",
  "/constraints",
  "/dashboard",
  "/finance",
  "/forecasting",
  "/get-started",
  "/help",
  "/inputs",
  "/integrations",
  "/marketing",
  "/metrics",
  "/retention",
  "/sales",
  "/settings",
];

const PUBLIC_PAGE_PREFIXES = [
  "/auth",
  "/forgot-password",
  "/invite/accept",
  "/login",
  "/opt-in",
  "/opt-in-thank-you",
  "/privacy",
  "/dq",
  "/reset-password",
  "/settings/team/accept",
  "/signup",
  "/thank-you",
  "/terms",
];

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

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production")
  );
}

function isAuthBypassEnabledForMiddleware() {
  if (isProductionRuntime()) return false;

  return (
    process.env.DISABLE_LOGIN_AUTH === "true" ||
    process.env.AUTH_BYPASS_ENABLED === "true"
  );
}

function isPageRequest(pathname: string) {
  return !pathname.startsWith("/api/");
}

function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublicPagePath(pathname: string) {
  return PUBLIC_PAGE_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));
}

function isProtectedPagePath(pathname: string) {
  if (isPublicPagePath(pathname)) return false;

  return PROTECTED_PAGE_PREFIXES.some((prefix) =>
    pathMatchesPrefix(pathname, prefix),
  );
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    authRedirectParam,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return withSecurityHeaders(NextResponse.redirect(loginUrl));
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !isAuthBypassEnabledForMiddleware() &&
    isPageRequest(request.nextUrl.pathname) &&
    isProtectedPagePath(request.nextUrl.pathname)
  ) {
    return redirectToLogin(request);
  }

  return withSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
