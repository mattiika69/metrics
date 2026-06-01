import { defaultBillingPlan } from "@/lib/billing/default-plan";
import { getStripePriceIds } from "@/lib/billing/prices";

export const dynamic = "force-dynamic";

export async function GET() {
  const stripePriceIds = getStripePriceIds();

  return Response.json({
    plans: [
      {
        ...defaultBillingPlan,
        stripePriceId: stripePriceIds.basic,
        stripePriceIds,
      },
    ],
  });
}
