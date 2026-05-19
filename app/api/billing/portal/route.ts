import { requireAdminContext } from "@/lib/api/context";
import { logAuditEvent } from "@/lib/security/audit";
import { createStripeClient } from "@/lib/stripe/server";
import { getAppBaseUrl } from "@/lib/urls/app";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await requireAdminContext();
  if ("error" in result) return result.error;

  const { context } = result;
  const { data: customer } = await context.supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("tenant_id", context.tenant.id)
    .maybeSingle();

  if (!customer?.stripe_customer_id) {
    return Response.json({ error: "Billing has not been started." }, { status: 404 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Billing portal is not available." }, { status: 503 });
  }

  const stripe = createStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: `${await getAppBaseUrl()}/settings/billing`,
  });

  await logAuditEvent({
    tenantId: context.tenant.id,
    actorUserId: context.user.id,
    eventType: "billing_portal_started",
    targetType: "tenant",
    targetId: context.tenant.id,
  });

  return Response.json({ url: session.url });
}
