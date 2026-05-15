import { Resend } from "resend";

export function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  return new Resend(apiKey);
}

export function getDefaultFromEmail() {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME;

  if (!fromEmail) {
    throw new Error("Missing RESEND_FROM_EMAIL.");
  }

  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
}
