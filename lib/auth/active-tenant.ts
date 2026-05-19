import { cookies } from "next/headers";

export const activeTenantCookieName = "hyperoptimal_active_tenant_id";

export async function getActiveTenantId() {
  const cookieStore = await cookies();
  return cookieStore.get(activeTenantCookieName)?.value ?? null;
}

export async function setActiveTenantId(tenantId: string) {
  const cookieStore = await cookies();
  cookieStore.set(activeTenantCookieName, tenantId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
