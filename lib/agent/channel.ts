import "server-only";

import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export type AgentChannelProvider = "slack" | "telegram";

const agentCommandPattern = /^(?:\/ai-agent|\/agent|ai agent|agent)\b/i;
const readPattern = /\b(read|show|list|summarize|find|look up|report|what|status)\b/i;
const writePattern = /\b(write|create|add|save|draft|generate|send)\b/i;
const editPattern = /\b(edit|update|change|remove|delete|archive|fix|modify)\b/i;

export function classifyAgentOperation(text: string) {
  if (editPattern.test(text)) return "edit";
  if (writePattern.test(text)) return "write";
  if (readPattern.test(text)) return "read";
  return "operate";
}

export function extractAgentRequestText({
  commandName,
  text,
}: {
  commandName?: string | null;
  text?: string | null;
}) {
  const command = (commandName ?? "").trim().toLowerCase();
  const value = (text ?? "").trim();

  if (command === "/agent" || command === "/ai-agent") {
    return value;
  }

  if (!agentCommandPattern.test(value)) return null;
  return value.replace(agentCommandPattern, "").trim();
}

export async function createChannelAgentRequest({
  tenantId,
  provider,
  channelId,
  externalUserId,
  requestText,
  metadata,
}: {
  tenantId: string;
  provider: AgentChannelProvider;
  channelId: string | null;
  externalUserId?: string | null;
  requestText: string;
  metadata?: Record<string, unknown>;
}) {
  const trimmed = requestText.trim();
  if (!trimmed) {
    return {
      ok: false as const,
      message: "Send a request after /agent.",
    };
  }

  const admin = createAdminClient();
  const operation = classifyAgentOperation(trimmed);
  const { data, error } = await admin
    .from("agent_requests")
    .insert({
      tenant_id: tenantId,
      provider,
      channel_id: channelId,
      request_text: trimmed,
      status: "requested",
      risk_level: "normal",
      metadata: {
        source: provider,
        operation,
        capabilities: ["read", "write", "edit"],
        externalUserId: externalUserId ?? null,
        ...(metadata ?? {}),
      },
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false as const,
      message: "AI Agent request could not be saved.",
      error: error.message,
    };
  }

  await logAuditEvent({
    tenantId,
    eventType: "agent_request_created",
    targetType: "agent_requests",
    targetId: data.id,
    metadata: {
      provider,
      channelId,
      externalUserId,
    },
  });

  return {
    ok: true as const,
    requestId: data.id as string,
    message: `AI Agent ${operation} request saved.`,
  };
}
