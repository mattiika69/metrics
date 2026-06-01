import { defaultBillingPlan } from "@/lib/billing/default-plan";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    plans: [
      {
        ...defaultBillingPlan,
        stripePriceId:
          process.env.STRIPE_ONBOARDING_PRICE_ID ?? process.env.STRIPE_PRICE_ID ?? null,
      },
    ],
  });
}
