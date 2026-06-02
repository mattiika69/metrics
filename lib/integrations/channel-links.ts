import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function upsertIntegrationChannelLink({
  admin,
  tenantId,
  provider,
  externalChannelId,
  displayName,
  linkedByUserId,
  metadata,
}: {
  admin: SupabaseClient;
  tenantId: string;
  provider: "slack" | "telegram";
  externalChannelId: string;
  displayName?: string | null;
  linkedByUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await admin.from("integration_channel_links").upsert(
    {
      tenant_id: tenantId,
      provider,
      external_channel_id: externalChannelId,
      display_name: displayName ?? null,
      linked_by_user_id: linkedByUserId ?? null,
      status: "active",
      metadata: metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,provider,external_channel_id" },
  );

  if (error) throw new Error(error.message);
}
