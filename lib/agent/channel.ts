import "server-only";

import { runUnifiedAgent } from "@/lib/agent/runner";
import { createAdminClient } from "@/lib/supabase/admin";

export type AgentChannelProvider = "slack" | "telegram";

const agentCommandPattern = /^(?:\/ai-agent|\/agent|ai agent|agent)\b/i;
const readPattern = /\b(read|show|list|summarize|find|look up|report|what|status)\b/i;
const writePattern = /\b(write|create|add|save|draft|generate|send)\b/i;
const editPattern = /\b(edit|update|change|remove|delete|archive|fix|modify)\b/i;
const helpPattern = /^(?:\/help|help|what can you do)\b/i;
const statusPattern = /^(?:\/status|status|are you connected)\b/i;

export function classifyAgentOperation(text: string) {
  if (editPattern.test(text)) return "edit";
  if (writePattern.test(text)) return "write";
  if (readPattern.test(text)) return "read";
  return "operate";
}

export function stripProviderMention(text: string) {
  return text
    .replace(/^<@[A-Z0-9]+>\s*/i, "")
    .replace(/^@\w+\s*/i, "")
    .trim();
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

export function resolveAgentRequestText({
  commandName,
  text,
  allowNaturalLanguage = false,
}: {
  commandName?: string | null;
  text?: string | null;
  allowNaturalLanguage?: boolean;
}) {
  const explicit = extractAgentRequestText({ commandName, text: stripProviderMention(text ?? "") });
  if (explicit !== null) return explicit;

  if (!allowNaturalLanguage) return null;

  const value = stripProviderMention(text ?? "");
  if (!value || value.startsWith("/")) return null;
  return value;
}

export function isAgentHelpRequest(text: string | null | undefined) {
  return helpPattern.test(stripProviderMention(text ?? ""));
}

export function isAgentStatusRequest(text: string | null | undefined) {
  return statusPattern.test(stripProviderMention(text ?? ""));
}

export function buildAgentHelpResponse() {
  return [
    "I can help with HyperOptimal Metrics from this channel.",
    "",
    "Try:",
    "- What changed today?",
    "- Show me this week's metrics.",
    "- What is our biggest constraint?",
    "- Create a task to follow up with Sarah tomorrow.",
    "",
    "I can read metrics and constraints, answer workspace questions, and ask for confirmation before risky changes.",
  ].join("\n");
}

export async function buildAgentStatusResponse({
  tenantId,
  provider,
  channelId,
}: {
  tenantId: string;
  provider: AgentChannelProvider;
  channelId: string | null;
}) {
  const admin = createAdminClient();
  const { count: recentCount } = await admin
    .from("integration_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .eq("external_channel_id", channelId);
  const { data: latest } = await admin
    .from("integration_messages")
    .select("created_at")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .eq("external_channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return [
    "This workspace connection is active in HyperOptimal Metrics.",
    `Messages recorded for this channel: ${recentCount ?? 0}`,
    `Last activity: ${latest?.created_at ? new Date(latest.created_at).toLocaleString("en-US") : "No activity yet"}`,
  ].join("\n");
}

export async function createChannelAgentRequest({
  tenantId,
  provider,
  channelId,
  externalWorkspaceId,
  externalThreadId,
  externalMessageId,
  externalUserId,
  externalUserName,
  requestText,
  metadata,
}: {
  tenantId: string;
  provider: AgentChannelProvider;
  channelId: string | null;
  externalWorkspaceId?: string | null;
  externalThreadId?: string | null;
  externalMessageId?: string | null;
  externalUserId?: string | null;
  externalUserName?: string | null;
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

  const reply = await runUnifiedAgent({
    tenantId,
    platform: provider,
    requestText: trimmed,
    externalWorkspaceId: externalWorkspaceId ?? channelId ?? null,
    externalConversationId: channelId ?? `${provider}:direct`,
    externalThreadId: externalThreadId ?? null,
    externalMessageId: externalMessageId ?? null,
    externalUserId,
    externalUserName,
    conversationType: provider === "slack" ? "channel" : "chat",
    metadata: {
      source: provider,
      operation: classifyAgentOperation(trimmed),
      capabilities: ["read", "write", "edit", "delete"],
      ...(metadata ?? {}),
    },
  });

  return {
    ok: true as const,
    requestId: reply.requestId,
    message: reply.responseText,
  };
}
