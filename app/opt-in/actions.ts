"use server";

import { redirect } from "next/navigation";
import { isValidEmailAddress } from "@/lib/email/send";
import { getRequestIp } from "@/lib/request/ip";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function redirectWithError(message: string): never {
  redirect(`/opt-in?error=${encodeURIComponent(message)}`);
}

export async function captureOptInLeadAction(formData: FormData) {
  const email = normalizeEmail(formValue(formData, "email"));
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const assetKey = "metrics-source-of-truth";

  if (!isValidEmailAddress(email)) {
    redirectWithError("Please enter a valid email address.");
  }

  const ip = await getRequestIp();
  const rateLimit = await checkRateLimit({
    route: "opt-in:capture",
    key: `${ip}:${email}`,
    limit: 5,
    windowSeconds: 600,
    metadata: {
      email,
    },
  });

  if (!rateLimit.allowed) {
    redirectWithError("Too many requests. Please wait and try again.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("opt_in_leads").upsert(
    {
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      source: "opt-in",
      asset_key: assetKey,
      status: "captured",
      metadata: {
        path: "/opt-in",
      },
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "email,asset_key",
    },
  );

  if (error) {
    redirectWithError("We could not save your request. Please try again.");
  }

  redirect(`/opt-in-thank-you?email=${encodeURIComponent(email)}`);
}
