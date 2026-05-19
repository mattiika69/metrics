import "server-only";

import {
  decryptSecretJson,
  encryptSecretJson,
  isEncryptedSecretJson,
} from "@/lib/security/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type SecretRecord = {
  secret_values: unknown;
};

function objectSecretValues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function decodeMetricIntegrationSecret(value: unknown) {
  if (isEncryptedSecretJson(value)) {
    return decryptSecretJson<Record<string, unknown>>(value);
  }

  return objectSecretValues(value);
}

export async function loadMetricIntegrationSecret(input: {
  tenantId: string;
  provider: string;
  tenantIntegrationId?: string | null;
  metricIntegrationId?: string | null;
  admin?: AdminClient;
}) {
  const admin = input.admin ?? createAdminClient();
  let query = admin
    .from("metric_integration_secrets")
    .select("secret_values")
    .eq("tenant_id", input.tenantId)
    .eq("provider", input.provider)
    .order("created_at", { ascending: false })
    .limit(1);

  if (input.tenantIntegrationId) {
    query = query.eq("tenant_integration_id", input.tenantIntegrationId);
  }

  if (input.metricIntegrationId) {
    query = query.eq("metric_integration_id", input.metricIntegrationId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  const record = data as SecretRecord | null;

  return decodeMetricIntegrationSecret(record?.secret_values);
}

export async function storeMetricIntegrationSecret(input: {
  tenantId: string;
  provider: string;
  values: Record<string, unknown>;
  metricIntegrationId?: string | null;
  tenantIntegrationId?: string | null;
  admin?: AdminClient;
}) {
  const admin = input.admin ?? createAdminClient();
  const { error } = await admin.from("metric_integration_secrets").insert({
    tenant_id: input.tenantId,
    metric_integration_id: input.metricIntegrationId ?? null,
    tenant_integration_id: input.tenantIntegrationId ?? null,
    provider: input.provider,
    secret_values: encryptSecretJson(input.values),
  });

  if (error) throw new Error(error.message);
}
