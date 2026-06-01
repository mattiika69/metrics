import "server-only";

import { headers } from "next/headers";

const PRODUCTION_APP_URL = "https://app.scalingmetrics.com";

function cleanBaseUrl(value: string | undefined | null) {
  if (!value) return null;

  const withProtocol = value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;

  try {
    const url = new URL(withProtocol);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isLocalUrl(value: string) {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function firstUsableUrl(values: Array<string | undefined | null>, allowLocal: boolean) {
  for (const value of values) {
    const url = cleanBaseUrl(value);
    if (!url) continue;
    if (!allowLocal && isLocalUrl(url)) continue;
    return url;
  }

  return null;
}

export async function getAppBaseUrl() {
  const headerStore = await headers();
  const requestOrigin = headerStore.get("origin") ?? headerStore.get("x-forwarded-host");
  const isProduction =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  const configuredUrls = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  return (
    firstUsableUrl(
      isProduction ? configuredUrls : [...configuredUrls, requestOrigin],
      !isProduction,
    ) ?? (isProduction ? PRODUCTION_APP_URL : "http://localhost:3000")
  );
}
