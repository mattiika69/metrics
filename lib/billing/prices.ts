import "server-only";

import {
  getOptionalServerEnv,
  getRequiredOneOfServerEnv,
  type ServerEnvName,
} from "@/lib/env/server";

const basicPriceEnvNames: ServerEnvName[] = [
  "STRIPE_PRICE_BASIC",
  "STRIPE_ONBOARDING_PRICE_ID",
  "STRIPE_PRICE_ID",
];

export function getStripePriceIds() {
  return {
    basic:
      getOptionalServerEnv("STRIPE_PRICE_BASIC") ??
      getOptionalServerEnv("STRIPE_ONBOARDING_PRICE_ID") ??
      getOptionalServerEnv("STRIPE_PRICE_ID"),
    pro: getOptionalServerEnv("STRIPE_PRICE_PRO"),
    business: getOptionalServerEnv("STRIPE_PRICE_BUSINESS"),
  };
}

export function getStripeBasicPriceId() {
  return getRequiredOneOfServerEnv(basicPriceEnvNames);
}
