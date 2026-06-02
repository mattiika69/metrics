import "server-only";

import { EnvConfigurationError } from "@/lib/env/public";

export const requiredServerEnvNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_BASIC",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_BUSINESS",
  "SLACK_APP_ID",
  "SLACK_BOT_TOKEN",
  "SLACK_CLIENT_ID",
  "SLACK_CLIENT_SECRET",
  "SLACK_SIGNING_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_USERNAME",
  "TELEGRAM_WEBHOOK_SECRET",
  "AI_MODEL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

export type ServerEnvName =
  | typeof requiredServerEnvNames[number]
  | "STRIPE_ONBOARDING_PRICE_ID"
  | "STRIPE_PRICE_ID"
  | "RESEND_FROM_EMAIL"
  | "RESEND_FROM_NAME"
  | "SLACK_APP_TOKEN"
  | "VERCEL_OIDC_TOKEN"
  | "ANTHROPIC_API_KEY"
  | "CLAUDE_MODEL"
  | "ANTHROPIC_MODEL";

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getOptionalServerEnv(name: ServerEnvName) {
  return readEnv(name) || null;
}

export function getRequiredServerEnv(name: ServerEnvName) {
  const value = readEnv(name);
  if (!value) throw new EnvConfigurationError([name]);
  return value;
}

export function getRequiredOneOfServerEnv(names: ServerEnvName[]) {
  const value = names.map((name) => readEnv(name)).find(Boolean);
  if (!value) throw new EnvConfigurationError(names);
  return value;
}

export function validateServerEnv(names: ServerEnvName[] = [...requiredServerEnvNames]) {
  const missing = names.filter((name) => !readEnv(name));
  if (missing.length) throw new EnvConfigurationError(missing);
}

export function envErrorResponse(error: unknown, status = 500) {
  if (error instanceof EnvConfigurationError) {
    return Response.json({ error: error.message }, { status });
  }

  throw error;
}
