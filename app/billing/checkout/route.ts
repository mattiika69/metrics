import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/settings/billing";
  url.searchParams.set("message", "Continue to billing from this page.");
  return NextResponse.redirect(url);
}
