import "server-only";

import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, ToolLoopAgent } from "ai";
import {
  type AgentPlatform,
  type AgentRole,
  resolvePlatformActor,
  upsertPlatformAccount,
  upsertPlatformConversation,
} from "@/lib/agent/platform";
import { createAgentTools, createToolContext, type AgentToolRegistry } from "@/lib/agent/tools";
import { getRequiredOneOfServerEnv, getRequiredServerEnv } from "@/lib/env/server";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export type UnifiedAgentInput = {
  tenantId: string;
  platform: AgentPlatform;
  requestText: string;
  webUserId?: string | null;
  webUserRole?: AgentRole | null;
  externalWorkspaceId?: string | null;
  externalConversationId?: string | null;
  externalThreadId?: string | null;
  externalMessageId?: string | null;
  externalUserId?: string | null;
  externalUserName?: string | null;
  conversationType?: string;
  metadata?: Record<string, unknown>;
};

export type UnifiedAgentResult = {
  ok: boolean;
  responseText: string;
  requestId?: string;
  conversationId?: string;
  approvalRequired?: boolean;
  model: string;
};

const highRiskPattern =
  /\b(delete|remove|archive|cancel|revoke|disconnect|demote|refund|change plan|upgrade|downgrade|payment method|seat|invite|owner|admin|permission|wipe|reset|destroy)\b/i;
const rawDataPattern = /\b(raw data|data source|source count|counts?)\b/i;
const billingPattern = /\b(billing|subscription|invoice|payment|plan)\b/i;
const metricPattern = /\b(metric|mrr|arr|revenue|profit|sales|finance|retention|constraint|forecast|dashboard|status|what happened|summarize)\b/i;

function stripAgentPrefix(text: string) {
  return text.replace(/^(?:\/ai-agent|\/agent|ai agent|agent)\b/i, "").trim();
}

function buildUnifiedAgentHelpResponse() {
  return [
    "I can help with HyperOptimal Metrics from the app, Slack, or Telegram.",
    "",
    "Try:",
    "- What changed today?",
    "- Show me this week's metrics.",
    "- What is our biggest constraint?",
    "- Check billing status.",
    "",
    "I can read workspace data, answer workspace questions, and prepare risky changes for confirmation.",
  ].join("\n");
}

function configuredAiModel() {
  const modelName = getRequiredServerEnv("AI_MODEL");
  getRequiredOneOfServerEnv(["ANTHROPIC_API_KEY", "VERCEL_OIDC_TOKEN"]);
  const anthropicModelName = modelName.replace(/^anthropic\//, "");
  const gatewayModelName = modelName.includes("/") ? modelName : `anthropic/${modelName}`;

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      label: modelName,
      model: anthropic(anthropicModelName),
    };
  }

  if (process.env.VERCEL_OIDC_TOKEN) {
    return {
      label: modelName,
      model: gatewayModelName as never,
    };
  }

  return {
    label: modelName,
    model: modelName as never,
  };
}

async function executeTool(
  tools: AgentToolRegistry,
  name: keyof AgentToolRegistry,
  input: Record<string, unknown>,
) {
  const selected = tools[name] as unknown as {
    execute?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  if (!selected.execute) return { ok: false, error: `${String(name)} is unavailable.` };
  return selected.execute(input);
}

function summarizeToolOutput(output: Record<string, unknown>) {
  if (output.approvalRequired) {
    return typeof output.message === "string"
      ? output.message
      : "I saved this for confirmation before making a risky change.";
  }
  if (output.error) return String(output.error);
  if (Array.isArray(output.metrics) && output.metrics.length) {
    return output.metrics
      .slice(0, 10)
      .map((metric) => {
        const row = metric as { name?: string; displayValue?: string };
        return `${row.name ?? "Metric"}: ${row.displayValue ?? "Not available"}`;
      })
      .join("\n");
  }
  if (Array.isArray(output.rawCounts) && output.rawCounts.length) {
    return output.rawCounts
      .map((row) => {
        const source = row as { label?: string; count?: number | null };
        return `${source.label}: ${source.count ?? "Unavailable"}`;
      })
      .join("\n");
  }
  if (output.record) return "Done. I found the matching record.";
  if (output.invitation) return "I created the team invitation record.";
  if (output.url) return `Open this secure billing portal link: ${output.url}`;
  if (output.ok) return "Done.";
  return "I saved the request, but I need a little more detail to finish it.";
}

async function deterministicRun({
  tools,
  requestText,
}: {
  tools: AgentToolRegistry;
  requestText: string;
}) {
  if (billingPattern.test(requestText)) {
    const output = await executeTool(tools, "get_billing_status", {});
    return summarizeToolOutput(output);
  }

  if (rawDataPattern.test(requestText)) {
    const output = await executeTool(tools, "search_app_data", {
      query: requestText,
      area: "raw_data",
    });
    return summarizeToolOutput(output);
  }

  if (metricPattern.test(requestText)) {
    const output = await executeTool(tools, "search_app_data", {
      query: requestText,
      area: "metrics",
    });
    return summarizeToolOutput(output);
  }

  const output = await executeTool(tools, "search_app_data", {
    query: requestText,
    area: "all",
  });
  return [
    summarizeToolOutput(output),
    "",
    "I can also summarize metrics, check billing status, and prepare risky changes for approval.",
  ].join("\n").trim();
}

async function requestApproval({
  tenantId,
  actorUserId,
  platform,
  requestId,
  requestText,
}: {
  tenantId: string;
  actorUserId: string;
  platform: AgentPlatform;
  requestId: string;
  requestText: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_approvals")
    .insert({
      tenant_id: tenantId,
      agent_request_id: requestId,
      requested_by_user_id: actorUserId,
      status: "pending",
      action_type: "agent_confirmation",
      target_type: "agent_requests",
      target_id: requestId,
      action_payload: { requestText },
      decision_notes: requestText,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await logAuditEvent({
    tenantId,
    actorUserId,
    platform,
    eventType: "agent_approval_required",
    targetType: "agent_approvals",
    targetId: data.id,
    metadata: { requestText },
  });

  return data.id as string;
}

export async function runUnifiedAgent(input: UnifiedAgentInput): Promise<UnifiedAgentResult> {
  const admin = createAdminClient();
  const requestText = stripAgentPrefix(input.requestText).trim();

  if (!requestText) {
    return {
      ok: false,
      responseText: "Send a request after /agent.",
      model: "validation",
    };
  }

  if (input.platform === "web" && input.webUserId) {
    await upsertPlatformAccount({
      admin,
      tenantId: input.tenantId,
      platform: "web",
      externalWorkspaceId: "web",
      externalUserId: input.webUserId,
      userId: input.webUserId,
      displayName: input.externalUserName ?? null,
    });
  }

  const actor = await resolvePlatformActor({
    admin,
    tenantId: input.tenantId,
    platform: input.platform,
    externalWorkspaceId: input.externalWorkspaceId,
    externalUserId: input.externalUserId,
    webUserId: input.webUserId,
  });

  if (!actor.ok) {
    await logAuditEvent({
      tenantId: input.tenantId,
      platform: input.platform,
      eventType: "agent_unlinked_actor_blocked",
      targetType: "agent",
      metadata: {
        reason: actor.reason,
        externalUserId: input.externalUserId ?? null,
      },
    });
    return {
      ok: false,
      responseText: actor.linkPrompt,
      model: "identity-gate",
    };
  }

  const conversationId = await upsertPlatformConversation({
    admin,
    tenantId: input.tenantId,
    platform: input.platform,
    externalConversationId: input.externalConversationId ?? `${input.platform}:${actor.userId}`,
    externalThreadId: input.externalThreadId ?? null,
    conversationType: input.conversationType ?? (input.platform === "web" ? "web_chat" : "channel"),
    title: input.externalConversationId ?? "Agent conversation",
    linkedByUserId: actor.userId,
  });

  const { data: request, error: requestError } = await admin
    .from("agent_requests")
    .insert({
      tenant_id: input.tenantId,
      requested_by_user_id: actor.userId,
      provider: input.platform,
      channel_id: input.externalConversationId ?? null,
      request_text: requestText,
      status: highRiskPattern.test(requestText) ? "needs_confirmation" : "requested",
      risk_level: highRiskPattern.test(requestText) ? "high" : "normal",
      metadata: {
        ...input.metadata,
        platformConversationId: conversationId,
        externalUserId: input.externalUserId ?? null,
        externalMessageId: input.externalMessageId ?? null,
      },
    })
    .select("id")
    .single();

  if (requestError) throw new Error(requestError.message);
  const requestId = request.id as string;

  await admin.from("agent_messages").insert({
    tenant_id: input.tenantId,
    platform_conversation_id: conversationId,
    agent_request_id: requestId,
    platform: input.platform,
    direction: "inbound",
    actor_user_id: actor.userId,
    external_user_id: input.externalUserId ?? null,
    external_message_id: input.externalMessageId ?? null,
    body: requestText,
    metadata: input.metadata ?? {},
  });

  await logAuditEvent({
    tenantId: input.tenantId,
    actorUserId: actor.userId,
    platform: input.platform,
    eventType: "agent_request_created",
    targetType: "agent_requests",
    targetId: requestId,
    metadata: { requestText },
  });

  let responseText: string;
  let model = "deterministic-tools";
  let approvalRequired = false;

  if (/^(help|what can you do)\b/i.test(requestText)) {
    responseText = buildUnifiedAgentHelpResponse();
  } else if (highRiskPattern.test(requestText)) {
    approvalRequired = true;
    const approvalId = await requestApproval({
      tenantId: input.tenantId,
      actorUserId: actor.userId,
      platform: input.platform,
      requestId,
      requestText,
    });
    responseText = [
      "I need explicit confirmation before making that kind of change.",
      `Approval saved: ${approvalId}`,
      "An owner or admin can confirm it through the approval workflow.",
    ].join("\n");
  } else {
    const toolContext = createToolContext({
      tenantId: input.tenantId,
      actorUserId: actor.userId,
      role: actor.role,
      platform: input.platform,
      platformAccountId: actor.platformAccountId,
      agentRequestId: requestId,
      platformConversationId: conversationId,
    });
    const tools = createAgentTools(toolContext);
    const aiModel = configuredAiModel();

    try {
      model = aiModel.label;
      const agent = new ToolLoopAgent({
        model: aiModel.model,
        instructions: [
          "You are the HyperOptimal Metrics AI teammate.",
          "You work with full parity across web, Slack, and Telegram.",
          "Use only the provided typed tools to read or change product data.",
          "Never expose secrets, raw payment data, tokens, service-role credentials, or data from another tenant.",
          "Ask a clarifying question when the target record or intent is ambiguous.",
          "Use request_approval for destructive, billing, permission-changing, or irreversible work.",
          "Keep replies concise, conversational, and specific about what changed.",
        ].join(" "),
        tools,
        stopWhen: stepCountIs(6),
      });
      const result = await agent.generate({
        prompt: [
          `Tenant ID: ${input.tenantId}`,
          `Platform: ${input.platform}`,
          `Actor role: ${actor.role}`,
          "",
          requestText,
        ].join("\n"),
      });
      responseText = result.text || await deterministicRun({ tools, requestText });
    } catch (error) {
      model = "deterministic-tools";
      await logAuditEvent({
        tenantId: input.tenantId,
        actorUserId: actor.userId,
        platform: input.platform,
        eventType: "agent_ai_failed",
        targetType: "agent_requests",
        targetId: requestId,
        metadata: { error: error instanceof Error ? error.message : "AI SDK agent failed" },
      });
      responseText = await deterministicRun({ tools, requestText });
    }
  }

  await Promise.all([
    admin.from("agent_messages").insert({
      tenant_id: input.tenantId,
      platform_conversation_id: conversationId,
      agent_request_id: requestId,
      platform: input.platform,
      direction: "outbound",
      actor_user_id: null,
      external_user_id: input.externalUserId ?? null,
      body: responseText,
      metadata: { model, approvalRequired },
    }),
    admin
      .from("agent_requests")
      .update({
        status: approvalRequired ? "needs_confirmation" : "completed",
        updated_at: new Date().toISOString(),
        metadata: {
          ...input.metadata,
          platformConversationId: conversationId,
          responseText,
          model,
        },
      })
      .eq("id", requestId),
  ]);

  return {
    ok: true,
    responseText,
    requestId,
    conversationId,
    approvalRequired,
    model,
  };
}
