import "server-only";

import { Resend } from "resend";
import {
  getRequiredOneOfServerEnv,
  getRequiredServerEnv,
} from "@/lib/env/server";

export function createResendClient() {
  return new Resend(getRequiredServerEnv("RESEND_API_KEY"));
}

export function getDefaultFromEmail() {
  const fromEmail = getRequiredOneOfServerEnv(["EMAIL_FROM", "RESEND_FROM_EMAIL"]);
  const fromName = process.env.RESEND_FROM_NAME?.trim();

  if (fromEmail.includes("<") && fromEmail.includes(">")) {
    return fromEmail;
  }

  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
}
