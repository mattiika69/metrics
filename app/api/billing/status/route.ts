import { requireTenantContext } from "@/lib/api/context";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireTenantContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const [{ data: customer }, { data: subscriptions }, { data: usage }] =
    await Promise.all([
      context.supabase
        .from("billing_customers")
        .select("stripe_customer_id, updated_at")
        .eq("tenant_id", context.tenant.id)
        .maybeSingle(),
      context.supabase
        .from("billing_subscriptions")
        .select("id, stripe_subscription_id, stripe_price_id, status, current_period_end, cancel_at_period_end, updated_at")
        .eq("tenant_id", context.tenant.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("billing_usage_records")
        .select("usage_key, quantity, period_start, period_end, updated_at")
        .eq("tenant_id", context.tenant.id)
        .order("period_start", { ascending: false })
        .limit(20),
    ]);

  return Response.json({
    customer,
    subscriptions: subscriptions ?? [],
    usage: usage ?? [],
  });
}
