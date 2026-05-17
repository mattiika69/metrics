import { requireAdminApi } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireAdminApi();
  if (context instanceof Response) return context;

  const overview = await getAdminOverview(context);
  return Response.json(overview);
}
