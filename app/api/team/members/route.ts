import { requireTenantContext } from "@/lib/api/context";

export const dynamic = "force-dynamic";

type Profile = {
  user_id: string;
  email: string;
  full_name: string | null;
};

export async function GET() {
  const result = await requireTenantContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { data: members, error } = await context.supabase
    .from("tenant_memberships")
    .select("tenant_id, user_id, role, created_at, updated_at")
    .eq("tenant_id", context.tenant.id)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 400 });

  const userIds = members?.map((member) => member.user_id) ?? [];
  const { data: profiles } = userIds.length
    ? await context.supabase
        .from("user_profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds)
    : { data: [] as Profile[] };
  const profileByUserId = new Map(
    (profiles as Profile[] | null)?.map((profile) => [profile.user_id, profile]) ?? [],
  );

  return Response.json({
    members: (members ?? []).map((member) => ({
      ...member,
      profile: profileByUserId.get(member.user_id) ?? null,
    })),
  });
}
