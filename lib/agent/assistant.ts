import "server-only";

import { createClaudeText } from "@/lib/ai/claude";
import { logAuditEvent } from "@/lib/security/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentSurface = "web" | "slack" | "telegram";

type AgentReplyInput = {
  supabase: SupabaseClient;
  tenantId: string;
  requestId?: string | null;
  provider: AgentSurface;
  channelId?: string | null;
  externalUserId?: string | null;
  requestText: string;
};

const savePattern = /\b(save|remember|learn|store|keep this|add this)\b/i;

function stripAgentPrefix(text: string) {
  return text.replace(/^(?:\/ai-agent|\/agent|ai agent|agent)\b/i, "").trim();
}

function extractLearningBody(text: string) {
  const trimmed = stripAgentPrefix(text);
  if (!savePattern.test(trimmed)) return null;
  return trimmed
    .replace(/^(?:please\s+)?(?:save|remember|learn|store)\s+(?:this|that)?\s*:?\s*/i, "")
    .replace(/^add\s+this\s*:?\s*/i, "")
    .trim();
}

function titleFromBody(body: string) {
  const title = body.split(/[.\n]/)[0]?.trim() || "Saved learning";
  return title.length > 80 ? `${title.slice(0, 77)}...` : title;
}

async function loadAgentContext({
  supabase,
  tenantId,
  provider,
  channelId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  provider: AgentSurface;
  channelId?: string | null;
}) {
  const [contextDoc, learnings, messages] = await Promise.all([
    supabase
      .from("ai_context_docs")
      .select("content")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("metric_learnings")
      .select("title, source, body, updated_at")
      .eq("tenant_id", tenantId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    channelId
      ? supabase
        .from("integration_messages")
        .select("direction, body, created_at")
        .eq("tenant_id", tenantId)
        .eq("provider", provider)
        .eq("external_channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(8)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    aiContext: typeof contextDoc.data?.content === "string" ? contextDoc.data.content.trim() : "",
    learnings: learnings.data ?? [],
    messages: (messages.data ?? []).reverse(),
  };
}

async function saveLearning({
  supabase,
  tenantId,
  provider,
  channelId,
  externalUserId,
  body,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  provider: AgentSurface;
  channelId?: string | null;
  externalUserId?: string | null;
  body: string;
}) {
  const { data, error } = await supabase
    .from("metric_learnings")
    .insert({
      tenant_id: tenantId,
      title: titleFromBody(body),
      source: "AI Agent",
      body,
      source_provider: provider,
      source_channel: channelId ?? null,
      metadata: {
        source: provider,
        externalUserId: externalUserId ?? null,
      },
    })
    .select("id, title")
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    tenantId,
    eventType: "agent_learning_saved",
    targetType: "metric_learnings",
    targetId: data.id,
    metadata: { provider, channelId },
  });

  return data;
}

function fallbackReply({ requestText, savedTitle }: { requestText: string; savedTitle?: string }) {
  if (savedTitle) return `Saved to learnings: ${savedTitle}`;
  return [
    "I saved your request and can use the workspace context and learnings for this conversation.",
    `Request: ${stripAgentPrefix(requestText) || requestText}`,
  ].join("\n");
}

export async function runAgentReply({
  supabase,
  tenantId,
  requestId,
  provider,
  channelId,
  externalUserId,
  requestText,
}: AgentReplyInput) {
  const trimmed = requestText.trim();
  const learningBody = extractLearningBody(trimmed);
  let savedLearning: { id: string; title: string } | null = null;

  if (learningBody) {
    savedLearning = await saveLearning({
      supabase,
      tenantId,
      provider,
      channelId,
      externalUserId,
      body: learningBody,
    });
  }

  const context = await loadAgentContext({ supabase, tenantId, provider, channelId });
  let responseText = fallbackReply({ requestText: trimmed, savedTitle: savedLearning?.title });
  let model = "deterministic-fallback";

  const claudeModel = process.env.CLAUDE_MODEL ?? process.env.ANTHROPIC_MODEL;
  if (process.env.ANTHROPIC_API_KEY && claudeModel) {
    try {
      model = claudeModel;
      responseText = await createClaudeText({
        system: [
          "You are the HyperOptimal Metrics AI Agent.",
          "You operate inside the web app, Slack, and Telegram with the same behavior.",
          "Use the AI Context Document and saved learnings as source material.",
          "If something was saved, confirm it clearly and briefly.",
          "Be concise, practical, and conversational. Do not invent data.",
        ].join(" "),
        messages: [
          {
            role: "user",
            content: [
              `Surface: ${provider}`,
              "",
              "AI Context Document:",
              context.aiContext || "No AI Context Document saved.",
              "",
              "Saved learnings:",
              context.learnings.length
                ? context.learnings.map((learning) => `- ${learning.title}: ${learning.body}`).join("\n")
                : "No saved learnings yet.",
              "",
              "Recent conversation:",
              context.messages.length
                ? context.messages.map((message) => `${message.direction}: ${message.body}`).join("\n")
                : "No recent conversation.",
              "",
              savedLearning ? `A new learning was saved: ${savedLearning.title}` : "",
              "",
              "User request:",
              trimmed,
            ].join("\n"),
          },
        ],
        maxTokens: 700,
        temperature: 0.3,
      });
    } catch (error) {
      model = "deterministic-fallback";
      responseText = fallbackReply({ requestText: trimmed, savedTitle: savedLearning?.title });
      await logAuditEvent({
        tenantId,
        eventType: "agent_llm_failed",
        targetType: "agent_requests",
        targetId: requestId ?? null,
        metadata: { provider, error: error instanceof Error ? error.message : "Claude failed" },
      });
    }
  }

  if (requestId) {
    await Promise.all([
      supabase
        .from("agent_requests")
        .update({
          status: "completed",
          metadata: {
            provider,
            channelId: channelId ?? null,
            model,
            responseText,
            savedLearningId: savedLearning?.id ?? null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId),
      supabase.from("agent_actions").insert({
        tenant_id: tenantId,
        agent_request_id: requestId,
        action_type: savedLearning ? "save_learning_and_reply" : "reply",
        status: "completed",
        metadata: {
          provider,
          model,
          responseText,
          savedLearningId: savedLearning?.id ?? null,
        },
      }),
    ]);
  }

  return {
    responseText,
    model,
    savedLearning,
  };
}
