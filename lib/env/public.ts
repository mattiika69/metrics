export const requiredPublicEnvNames = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
] as const;

export type PublicEnvName = typeof requiredPublicEnvNames[number] | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

const publicEnvValues: Record<PublicEnvName, string | undefined> = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

export class EnvConfigurationError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
    this.name = "EnvConfigurationError";
    this.missing = missing;
  }
}

function readEnv(name: string) {
  return publicEnvValues[name as PublicEnvName]?.trim() ?? "";
}

export function getRequiredPublicEnv(name: PublicEnvName) {
  if (!name.startsWith("NEXT_PUBLIC_")) {
    throw new EnvConfigurationError([name]);
  }

  const value = readEnv(name);
  if (!value) throw new EnvConfigurationError([name]);
  return value;
}

export function getRequiredOneOfPublicEnv(names: PublicEnvName[]) {
  const value = names.map((name) => readEnv(name)).find(Boolean);
  if (!value) throw new EnvConfigurationError(names);
  return value;
}

export function validatePublicEnv(names: PublicEnvName[] = [...requiredPublicEnvNames]) {
  const missing = names.filter((name) => !readEnv(name));
  if (missing.length) throw new EnvConfigurationError(missing);
}
