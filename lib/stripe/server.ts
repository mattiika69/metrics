import "server-only";

import Stripe from "stripe";
import { getRequiredServerEnv } from "@/lib/env/server";

export function createStripeClient() {
  const secretKey = getRequiredServerEnv("STRIPE_SECRET_KEY");

  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}
