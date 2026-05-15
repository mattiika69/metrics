import { headers } from "next/headers";
import { getRequestIp } from "@/lib/request/ip";
import { logAuditEvent } from "@/lib/security/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  markWebhookFailed,
  markWebhookProcessed,
  recordWebhookEvent,
} from "@/lib/security/webhooks";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/server";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    route: "webhook:stripe",
    key: await getRequestIp(),
    limit: 120,
    windowSeconds: 60,
    metadata: {
      provider: "stripe",
    },
  });

  if (!rateLimit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

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

  const webhook = await recordWebhookEvent({
    provider: "stripe",
    externalEventId: event.id,
    eventType: event.type,
    payload: {
      id: event.id,
      type: event.type,
      created: event.created,
    },
  });

  if (webhook.duplicate) {
    return Response.json({ received: true, duplicate: true });
  }

  await logAuditEvent({
    eventType: "stripe_webhook_received",
    targetType: "webhook_event",
    targetId: webhook.id,
    metadata: {
      eventId: event.id,
      eventType: event.type,
    },
  });

  try {
    let tenantId: string | null = null;
    const admin = createAdminClient();

    await admin.from("billing_events").insert({
      tenant_id: null,
      stripe_event_id: event.id,
      event_type: event.type,
      status: "processing",
      payload: {
        id: event.id,
        type: event.type,
        created: event.created,
      },
    });

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      tenantId = await syncSubscription(event.data.object);
    }

    await markWebhookProcessed(webhook.id, tenantId);
    await admin
      .from("billing_events")
      .update({
        tenant_id: tenantId,
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);
    await logAuditEvent({
      tenantId,
      eventType: "stripe_webhook_processed",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        eventId: event.id,
        eventType: event.type,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markWebhookFailed(webhook.id, message);
    await createAdminClient()
      .from("billing_events")
      .update({
        status: "failed",
        error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);
    await logAuditEvent({
      eventType: "stripe_webhook_failed",
      targetType: "webhook_event",
      targetId: webhook.id,
      metadata: {
        eventId: event.id,
        eventType: event.type,
        error: message,
      },
    });

    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
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

  const { data: billingSubscription } = await supabase.from("billing_subscriptions").upsert(
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
  ).select("id").single();

  for (const item of subscription.items.data) {
    await supabase.from("billing_subscription_items").upsert(
      {
        tenant_id: tenantId,
        billing_subscription_id: billingSubscription?.id ?? null,
        stripe_subscription_item_id: item.id,
        stripe_subscription_id: subscription.id,
        stripe_product_id:
          typeof item.price.product === "string"
            ? item.price.product
            : item.price.product.id,
        stripe_price_id: item.price.id,
        quantity: item.quantity ?? 1,
        status: subscription.status,
        metadata: item.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_item_id" },
    );
  }

  return tenantId;
}
