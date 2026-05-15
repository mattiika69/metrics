export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    plans: [
      {
        id: "v1",
        name: "HyperOptimal Metrics",
        stripePriceId:
          process.env.STRIPE_ONBOARDING_PRICE_ID ?? process.env.STRIPE_PRICE_ID ?? null,
        seatBased: true,
      },
    ],
  });
}
