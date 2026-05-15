import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextUrl = new URL("/settings/team/accept", url.origin);
  const token = url.searchParams.get("token");

  if (token) {
    nextUrl.searchParams.set("token", token);
  }

  return NextResponse.redirect(nextUrl);
}
