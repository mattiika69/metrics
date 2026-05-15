import { randomBytes } from "node:crypto";

export const slackOAuthStateCookie = "hom_slack_oauth_state";
export const slackOAuthTenantCookie = "hom_slack_oauth_tenant";

const authorizeUrl = "https://slack.com/oauth/v2/authorize";
const tokenUrl = "https://slack.com/api/oauth.v2.access";

export function createSlackOAuthState() {
  return randomBytes(24).toString("hex");
}

export function getSlackRedirectUri(origin: string) {
  return `${origin.replace(/\/+$/, "")}/api/integrations/slack/oauth/callback`;
}

export function buildSlackAuthorizeUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error("Missing SLACK_CLIENT_ID.");

  const url = new URL(authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", getSlackRedirectUri(origin));
  url.searchParams.set("scope", "commands,chat:write,app_mentions:read,channels:read,groups:read,im:read,mpim:read");
  return url.toString();
}

export async function exchangeSlackOAuthCode({
  code,
  origin,
}: {
  code: string;
  origin: string;
}) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Slack OAuth environment variables.");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getSlackRedirectUri(origin),
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `Slack OAuth exchange failed with ${response.status}.`);
  }

  return payload as {
    access_token: string;
    team?: { id?: string; name?: string };
    bot_user_id?: string;
    bot_id?: string;
    app_id?: string;
    scope?: string;
    authed_user?: { id?: string };
  };
}

export async function sendSlackMessage({
  botToken,
  channel,
  text,
}: {
  botToken: string;
  channel: string;
  text: string;
}) {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok && payload?.ok === true,
    status: response.status,
    error: payload?.error ?? null,
    payload,
  };
}
