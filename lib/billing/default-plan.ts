export const defaultBillingPlan = {
  id: "v1",
  name: "HyperOptimal Metrics",
  priceCents: 100,
  currency: "usd",
  interval: "month",
  displayPrice: "$1/mo",
  seatBased: true,
} as const;
