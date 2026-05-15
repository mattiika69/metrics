import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/security/audit";

export type RateLimitInput = {
  route: string;
  key: string;
  limit: number;
  windowSeconds: number;
  tenantId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  resetAt: string;
};

type RateLimitRpcRow = {
  allowed: boolean;
  current_count: number;
  reset_at: string;
};

function hashRateLimitKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function checkRateLimit(
  input: RateLimitInput,
): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("increment_rate_limit", {
      target_route: input.route,
      target_key_hash: hashRateLimitKey(input.key),
      max_requests: input.limit,
      window_seconds: input.windowSeconds,
    })
    .single();

  if (error || !data) {
    console.error("rate limit check failed", error);
    return {
      allowed: true,
      count: 0,
      resetAt: new Date(Date.now() + input.windowSeconds * 1000).toISOString(),
    };
  }

  const row = data as RateLimitRpcRow;
  const result = {
    allowed: Boolean(row.allowed),
    count: Number(row.current_count),
    resetAt: String(row.reset_at),
  };

  if (!result.allowed) {
    await logAuditEvent({
      tenantId: input.tenantId ?? null,
      actorUserId: input.actorUserId ?? null,
      eventType: "rate_limit_exceeded",
      targetType: "route",
      targetId: input.route,
      metadata: {
        count: result.count,
        resetAt: result.resetAt,
        ...input.metadata,
      },
    });
  }

  return result;
}
