import "server-only";

import { randomBytes } from "node:crypto";
import { tool } from "ai";
import { z } from "zod";
import { createStripeClient } from "@/lib/stripe/server";
import { getRequiredPublicEnv } from "@/lib/env/public";
import { sendTenantEmail } from "@/lib/email/send";
import { escapeEmailHtml } from "@/lib/email/templates";
import { loadRawDataCounts, loadMetricSnapshotPayload, periodFromSearch } from "@/lib/metrics/server";
import { metricDefinitions } from "@/lib/metrics/definitions";
import { formatMetricValue } from "@/lib/metrics/format";
import { logAuditEvent } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentPlatform, AgentRole } from "@/lib/agent/platform";

export type AgentToolContext = {
  admin: SupabaseClient;
  tenantId: string;
  actorUserId: string;
  role: AgentRole;
  platform: AgentPlatform;
  platformAccountId?: string | null;
  agentRequestId?: string | null;
  platformConversationId?: string | null;
};

type ToolResult = Record<string, unknown>;

async function recordCapability({
  context,
  capability,
  allowed,
  reason,
  metadata,
}: {
  context: AgentToolContext;
  capability: string;
  allowed: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  await context.admin.from("capability_checks").insert({
    tenant_id: context.tenantId,
    platform: context.platform,
    platform_account_id: context.platformAccountId ?? null,
    actor_user_id: context.actorUserId,
    capability,
    allowed,
    reason: reason ?? null,
    metadata: metadata ?? {},
  });
}

function canWrite(role: AgentRole) {
  return role === "owner" || role === "admin";
}

async function withToolRun(
  context: AgentToolContext,
  toolName: string,
  input: Record<string, unknown>,
  run: () => Promise<ToolResult>,
) {
  const startedAt = new Date().toISOString();
  const { data: row } = await context.admin
    .from("agent_tool_runs")
    .insert({
      tenant_id: context.tenantId,
      agent_request_id: context.agentRequestId ?? null,
      tool_name: toolName,
      status: "running",
      input_metadata: input,
      output_metadata: {},
      created_at: startedAt,
      updated_at: startedAt,
    })
    .select("id")
    .maybeSingle();

  try {
    const output = await run();
    if (row?.id) {
      await context.admin
        .from("agent_tool_runs")
        .update({
          status: "completed",
          output_metadata: output,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool failed.";
    if (row?.id) {
      await context.admin
        .from("agent_tool_runs")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
    return { ok: false, error: message };
  }
}

export function createAgentTools(context: AgentToolContext) {
  return {
    search_app_data: tool({
      description: "Search HyperOptimal Metrics data, metrics, and raw data counts for the current tenant.",
      inputSchema: z.object({
        query: z.string().default(""),
        area: z.enum(["all", "metrics", "raw_data"]).default("all"),
        period: z.string().optional(),
      }),
      execute: async (input) => withToolRun(context, "search_app_data", input, async () => {
        await recordCapability({ context, capability: "agent.read", allowed: true });
        const periodKey = periodFromSearch(input.period);
        const [snapshot, rawCounts] = await Promise.all([
          input.area === "all" || input.area === "metrics"
            ? loadMetricSnapshotPayload({ supabase: context.admin, tenantId: context.tenantId, periodKey })
            : null,
          input.area === "all" || input.area === "raw_data"
            ? loadRawDataCounts(context.admin, context.tenantId)
            : [],
        ]);

        const metricSummary = snapshot
          ? metricDefinitions.slice(0, 16).map((definition) => ({
            id: definition.id,
            name: definition.name,
            value: snapshot.metrics[definition.id]?.value ?? null,
            displayValue: formatMetricValue(definition.format, snapshot.metrics[definition.id]?.value ?? null),
          }))
          : [];

        return {
          ok: true,
          query: input.query,
          period: periodKey,
          metrics: metricSummary,
          rawCounts,
        };
      }),
    }),

    get_record: tool({
      description: "Get a specific supported app record by type and id.",
      inputSchema: z.object({
        recordType: z.enum(["agent_memory", "billing_status"]),
        id: z.string().optional(),
      }),
      execute: async (input) => withToolRun(context, "get_record", input, async () => {
        await recordCapability({ context, capability: "agent.read", allowed: true });
        if (input.recordType === "billing_status") {
          const { data } = await context.admin
            .from("billing_subscriptions")
            .select("status, stripe_price_id, current_period_end, cancel_at_period_end, metadata, updated_at")
            .eq("tenant_id", context.tenantId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return { ok: true, recordType: input.recordType, record: data ?? null };
        }

        const { data, error } = await context.admin
          .from("agent_memories")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .eq("id", input.id ?? "")
          .maybeSingle();
        if (error) throw new Error(error.message);
        return { ok: true, recordType: input.recordType, record: data ?? null };
      }),
    }),

    create_record: tool({
      description: "Create a safe supported record.",
      inputSchema: z.object({
        recordType: z.literal("agent_memory"),
        title: z.string().min(1),
        body: z.string().min(1),
      }),
      execute: async (input) => withToolRun(context, "create_record", input, async () => {
        const allowed = canWrite(context.role);
        await recordCapability({
          context,
          capability: "agent.write",
          allowed,
          reason: allowed ? undefined : "Owner or admin role required.",
        });
        if (!allowed) return { ok: false, error: "Owner or admin role required." };

        const { data, error } = await context.admin.from("agent_memories").insert({
          tenant_id: context.tenantId,
          created_by_user_id: context.actorUserId,
          source_platform: context.platform,
          title: input.title,
          body: input.body,
          memory_type: "preference",
          metadata: { agentRequestId: context.agentRequestId ?? null },
        }).select("*").single();
        if (error) throw new Error(error.message);
        await logAuditEvent({
          tenantId: context.tenantId,
          actorUserId: context.actorUserId,
          platform: context.platform,
          eventType: `${input.recordType}_created`,
          targetType: "agent_memories",
          targetId: String(data.id),
          afterState: data,
        });
        return { ok: true, recordType: input.recordType, record: data };
      }),
    }),

    update_record: tool({
      description: "Update a supported memory record after identifying exactly one target.",
      inputSchema: z.object({
        recordType: z.literal("agent_memory"),
        id: z.string().optional(),
        title: z.string().optional(),
        body: z.string().optional(),
      }),
      execute: async (input) => withToolRun(context, "update_record", input, async () => {
        const allowed = canWrite(context.role);
        await recordCapability({ context, capability: "agent.write", allowed, reason: allowed ? undefined : "Owner or admin role required." });
        if (!allowed) return { ok: false, error: "Owner or admin role required." };
        if (!input.title && !input.body) return { ok: false, error: "Nothing to update." };

        const { data: existing, error: existingError } = await context.admin
          .from("agent_memories")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .eq("id", input.id ?? "")
          .maybeSingle();
        if (existingError) throw new Error(existingError.message);
        if (!existing) return { ok: false, needsClarification: true, error: "I could not find exactly one record to update." };

        const patch = {
          ...(input.title ? { title: input.title } : {}),
          ...(input.body ? { body: input.body } : {}),
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await context.admin
          .from("agent_memories")
          .update(patch)
          .eq("tenant_id", context.tenantId)
          .eq("id", String(existing.id))
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        await logAuditEvent({
          tenantId: context.tenantId,
          actorUserId: context.actorUserId,
          platform: context.platform,
          eventType: `${input.recordType}_updated`,
          targetType: "agent_memories",
          targetId: String(existing.id),
          beforeState: existing,
          afterState: data,
        });
        return { ok: true, recordType: input.recordType, record: data };
      }),
    }),

    delete_record: tool({
      description: "Request approval for deleting or archiving supported records. Destructive actions are never performed without confirmation.",
      inputSchema: z.object({
        recordType: z.literal("agent_memory"),
        id: z.string().optional(),
        query: z.string().optional(),
        reason: z.string().optional(),
      }),
      execute: async (input) => withToolRun(context, "delete_record", input, async () => {
        const allowed = canWrite(context.role);
        await recordCapability({ context, capability: "agent.delete", allowed, reason: allowed ? "confirmation_required" : "Owner or admin role required." });
        if (!allowed) return { ok: false, error: "Owner or admin role required." };
        const { data, error } = await context.admin
          .from("agent_approvals")
          .insert({
            tenant_id: context.tenantId,
            agent_request_id: context.agentRequestId ?? null,
            requested_by_user_id: context.actorUserId,
            status: "pending",
            decision_notes: `Delete ${input.recordType}: ${input.id ?? input.query ?? "unspecified"}`,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return { ok: false, approvalRequired: true, approvalId: data.id, message: "I need explicit confirmation before deleting or archiving that record." };
      }),
    }),

    invite_team_member: tool({
      description: "Request approval for a team invitation. Permission-changing actions are not executed directly from chat.",
      inputSchema: z.object({
        email: z.string().email(),
        role: z.enum(["admin", "member"]).default("member"),
      }),
      execute: async (input) => withToolRun(context, "invite_team_member", input, async () => {
        const allowed = canWrite(context.role);
        await recordCapability({ context, capability: "team.invite", allowed, reason: allowed ? undefined : "Owner or admin role required." });
        if (!allowed) return { ok: false, error: "Owner or admin role required." };
        const normalizedEmail = input.email.trim().toLowerCase();
        const { data, error } = await context.admin
          .from("agent_approvals")
          .insert({
            tenant_id: context.tenantId,
            agent_request_id: context.agentRequestId ?? null,
            requested_by_user_id: context.actorUserId,
            status: "pending",
            action_type: "team_invite",
            target_type: "tenant_invitations",
            action_payload: {
              email: normalizedEmail,
              role: input.role,
            },
            decision_notes: `Invite ${normalizedEmail} as ${input.role}`,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return {
          ok: false,
          approvalRequired: true,
          approvalId: data.id,
          message: "I need explicit owner or admin confirmation before inviting a team member.",
        };
      }),
    }),

    remove_team_member: tool({
      description: "Request approval before removing a team member. Last owner protections apply in the confirmation flow.",
      inputSchema: z.object({
        userId: z.string().optional(),
        email: z.string().email().optional(),
        reason: z.string().optional(),
      }),
      execute: async (input) => withToolRun(context, "remove_team_member", input, async () => {
        const allowed = context.role === "owner";
        await recordCapability({ context, capability: "team.remove", allowed, reason: allowed ? "confirmation_required" : "Owner role required." });
        if (!allowed) return { ok: false, error: "Owner role required." };
        const { data, error } = await context.admin
          .from("agent_approvals")
          .insert({
            tenant_id: context.tenantId,
            agent_request_id: context.agentRequestId ?? null,
            requested_by_user_id: context.actorUserId,
            status: "pending",
            action_type: "team_remove",
            target_type: "tenant_memberships",
            target_id: input.userId ?? null,
            action_payload: {
              userId: input.userId ?? null,
              email: input.email ?? null,
              reason: input.reason ?? null,
            },
            decision_notes: `Remove team member: ${input.userId ?? input.email ?? "unspecified"}`,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return { ok: false, approvalRequired: true, approvalId: data.id, message: "I need explicit owner confirmation before removing a team member." };
      }),
    }),

    get_billing_status: tool({
      description: "Read tenant billing status without exposing raw payment details.",
      inputSchema: z.object({}),
      execute: async (input) => withToolRun(context, "get_billing_status", input, async () => {
        await recordCapability({ context, capability: "billing.read", allowed: true });
        const { data } = await context.admin
          .from("billing_subscriptions")
          .select("status, stripe_price_id, current_period_end, cancel_at_period_end, updated_at")
          .eq("tenant_id", context.tenantId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ok: true, billing: data ?? null };
      }),
    }),

    create_billing_portal_session: tool({
      description: "Create a Stripe Customer Portal URL for an owner/admin. Does not expose raw payment data.",
      inputSchema: z.object({
        returnUrl: z.string().url().optional(),
      }),
      execute: async (input) => withToolRun(context, "create_billing_portal_session", input, async () => {
        const allowed = canWrite(context.role);
        await recordCapability({ context, capability: "billing.manage", allowed, reason: allowed ? undefined : "Owner or admin role required." });
        if (!allowed) return { ok: false, error: "Owner or admin role required." };
        const { data: customer } = await context.admin
          .from("billing_customers")
          .select("stripe_customer_id")
          .eq("tenant_id", context.tenantId)
          .maybeSingle();
        if (!customer?.stripe_customer_id) return { ok: false, error: "No Stripe customer is connected yet." };
        const stripe = createStripeClient();
        const fallbackReturnUrl = `${getRequiredPublicEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "")}/settings/billing`;
        const session = await stripe.billingPortal.sessions.create({
          customer: customer.stripe_customer_id,
          return_url: input.returnUrl ?? fallbackReturnUrl,
        });
        await logAuditEvent({
          tenantId: context.tenantId,
          actorUserId: context.actorUserId,
          platform: context.platform,
          eventType: "billing_portal_created",
          targetType: "billing_customers",
        });
        return { ok: true, url: session.url };
      }),
    }),

    send_email: tool({
      description: "Send a tenant-scoped email and log it with idempotency. Use only for allowed operational messages.",
      inputSchema: z.object({
        to: z.array(z.string().email()).min(1).max(5),
        subject: z.string().min(1),
        text: z.string().min(1),
        idempotencyKey: z.string().optional(),
      }),
      execute: async (input) => withToolRun(context, "send_email", input, async () => {
        const allowed = canWrite(context.role);
        await recordCapability({ context, capability: "email.send", allowed, reason: allowed ? undefined : "Owner or admin role required." });
        if (!allowed) return { ok: false, error: "Owner or admin role required." };
        const html = `<p>${escapeEmailHtml(input.text).replaceAll("\n", "<br />")}</p>`;
        const result = await sendTenantEmail({
          tenantId: context.tenantId,
          actorUserId: context.actorUserId,
          to: input.to,
          subject: input.subject,
          text: input.text,
          html,
          template: "agent_message",
          idempotencyKey: input.idempotencyKey ?? `agent:${context.agentRequestId ?? randomBytes(12).toString("hex")}`,
          metadata: { platform: context.platform },
        });
        return {
          ok: result.ok,
          emailMessageId: result.emailMessageId,
          providerMessageId: result.providerMessageId,
          error: result.error,
        };
      }),
    }),

    summarize_activity: tool({
      description: "Summarize recent agent and integration activity for this tenant.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (input) => withToolRun(context, "summarize_activity", input, async () => {
        await recordCapability({ context, capability: "agent.read", allowed: true });
        const { data } = await context.admin
          .from("agent_messages")
          .select("platform, direction, body, created_at")
          .eq("tenant_id", context.tenantId)
          .order("created_at", { ascending: false })
          .limit(input.limit);
        return { ok: true, messages: data ?? [] };
      }),
    }),

    request_approval: tool({
      description: "Create a pending approval for high-risk, destructive, billing, or permission-changing actions.",
      inputSchema: z.object({
        action: z.string().min(1),
        targetType: z.string().optional(),
        targetId: z.string().optional(),
        summary: z.string().min(1),
      }),
      execute: async (input) => withToolRun(context, "request_approval", input, async () => {
        const { data, error } = await context.admin
          .from("agent_approvals")
          .insert({
            tenant_id: context.tenantId,
            agent_request_id: context.agentRequestId ?? null,
            requested_by_user_id: context.actorUserId,
            status: "pending",
            decision_notes: `${input.action}: ${input.summary}`,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return { ok: false, approvalRequired: true, approvalId: data.id };
      }),
    }),

    confirm_approval: tool({
      description: "Record an approval confirmation decision. This does not bypass tool-specific authorization.",
      inputSchema: z.object({
        approvalId: z.string(),
        decision: z.enum(["approved", "rejected"]),
        notes: z.string().optional(),
      }),
      execute: async (input) => withToolRun(context, "confirm_approval", input, async () => {
        const allowed = canWrite(context.role);
        await recordCapability({ context, capability: "approval.confirm", allowed, reason: allowed ? undefined : "Owner or admin role required." });
        if (!allowed) return { ok: false, error: "Owner or admin role required." };
        const { data, error } = await context.admin
          .from("agent_approvals")
          .update({
            status: input.decision,
            approved_by_user_id: input.decision === "approved" ? context.actorUserId : null,
            decision_notes: input.notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", context.tenantId)
          .eq("id", input.approvalId)
          .select("id, status")
          .single();
        if (error) throw new Error(error.message);
        await logAuditEvent({
          tenantId: context.tenantId,
          actorUserId: context.actorUserId,
          platform: context.platform,
          eventType: "agent_approval_decision",
          targetType: "agent_approvals",
          targetId: data.id,
          afterState: data,
        });
        return { ok: true, approval: data };
      }),
    }),
  };
}

export type AgentToolRegistry = ReturnType<typeof createAgentTools>;

export function createToolContext(input: Omit<AgentToolContext, "admin">): AgentToolContext {
  return {
    admin: createAdminClient(),
    ...input,
  };
}
