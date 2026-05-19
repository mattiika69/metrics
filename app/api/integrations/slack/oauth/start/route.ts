import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireApiTenant } from "@/lib/auth/api";
import {
  buildSlackAuthorizeUrl,
  createSlackOAuthState,
  slackOAuthStateCookie,
  slackOAuthTenantCookie,
} from "@/lib/integrations/slack-oauth";
import { getAppBaseUrl } from "@/lib/urls/app";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireApiTenant();
  if ("error" in context) return context.error;

  const state = createSlackOAuthState();
  const origin = await getAppBaseUrl();
  const cookieStore = await cookies();
  cookieStore.set(slackOAuthStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  });
  cookieStore.set(slackOAuthTenantCookie, context.tenant.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  });

  redirect(buildSlackAuthorizeUrl({ origin, state }));
}
