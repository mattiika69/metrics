import { requireApiTenant } from "@/lib/auth/api";

export async function requireTenantContext() {
  const context = await requireApiTenant();

  if ("error" in context) {
    return { error: context.error };
  }

  return { context };
}

export async function requireAdminContext() {
  const result = await requireTenantContext();

  if ("error" in result) {
    return result;
  }

  if (result.context.membership.role !== "owner" && result.context.membership.role !== "admin") {
    return {
      error: Response.json(
        { error: "Workspace admin access is required." },
        { status: 403 },
      ),
    };
  }

  return result;
}

export function routeIdFromUrl(request: Request, key = "id") {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}
