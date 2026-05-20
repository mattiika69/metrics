import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminContext } from "@/lib/api/context";
import {
  buildSlackAuthorizeUrl,
  createSlackOAuthState,
  slackOAuthStateCookie,
  slackOAuthTenantCookie,
} from "@/lib/integrations/slack-oauth";
import { getAppBaseUrl } from "@/lib/urls/app";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;

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
