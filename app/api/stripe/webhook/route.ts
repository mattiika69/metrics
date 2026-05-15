import { headers } from "next/headers";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/server";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return Response.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET." },
      { status: 500 },
    );
  }

  const stripe = createStripeClient();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncSubscription(event.data.object);
  }

  return Response.json({ received: true });
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata.tenant_id;
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  if (!tenantId) {
    throw new Error("Stripe subscription is missing tenant_id metadata.");
  }

  const subscriptionItem = subscription.items.data[0];
  const priceId = subscriptionItem?.price.id ?? null;
  const currentPeriodEnd = subscriptionItem?.current_period_end ?? null;
  const supabase = createAdminClient();

  await supabase.from("billing_customers").upsert({
    tenant_id: tenantId,
    stripe_customer_id: stripeCustomerId,
    updated_at: new Date().toISOString(),
  });

  await supabase.from("billing_subscriptions").upsert(
    {
      tenant_id: tenantId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: stripeCustomerId,
      stripe_price_id: priceId,
      status: subscription.status,
      current_period_end: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
      metadata: subscription.metadata,
    },
    {
      onConflict: "stripe_subscription_id",
    },
  );
}
