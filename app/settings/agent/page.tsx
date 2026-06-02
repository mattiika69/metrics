import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import {
  approveAgentApprovalAction,
  createWebAgentRequestAction,
  rejectAgentApprovalAction,
  saveAgentLearningAction,
} from "@/app/settings/agent/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function canManageAgent(role: string) {
  return role === "owner" || role === "admin";
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function requestOperation(metadata: unknown, fallback: string) {
  if (metadata && typeof metadata === "object" && "operation" in metadata) {
    const operation = (metadata as { operation?: unknown }).operation;
    if (typeof operation === "string" && operation) return operation;
  }

  return fallback;
}

export default async function AgentSettingsPage({ searchParams }: PageProps) {
  const { supabase, tenant, user, membership } = await requireTenant();
  const params = await searchParams;
  const message = param(params, "message");
  const error = param(params, "error");
  const canManage = canManageAgent(membership.role);
  const { data: requests } = await supabase
    .from("agent_requests")
    .select("id, request_text, status, risk_level, provider, metadata, created_at, updated_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(8);
  const { data: messages } = await supabase
    .from("agent_messages")
    .select("id, direction, body, platform, metadata, created_at")
    .eq("tenant_id", tenant.id)
    .eq("platform", "web")
    .or(`actor_user_id.eq.${user.id},external_user_id.eq.${user.id}`)
    .order("created_at", { ascending: true })
    .limit(24);
  const { data: approvals } = canManage
    ? await supabase
      .from("agent_approvals")
      .select("id, status, action_type, decision_notes, created_at")
      .eq("tenant_id", tenant.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(6)
    : { data: [] };
  const { data: learnings } = await supabase
    .from("metric_learnings")
    .select("id, title, body, source_provider, updated_at")
    .eq("tenant_id", tenant.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(6);

  return (
    <AppShell active="settings-agent" tenantName={tenant.name}>
      <SettingsHeader title="AI Agent" />
      <section className="settings-notices">
        {message ? <p className="notice">AI Agent request saved.</p> : null}
        {error ? <p className="notice error">{error.replaceAll("_", " ")}</p> : null}
      </section>
      <SettingsTabs active="agent" />

      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">AI Agent</p>
              <h2>Workspace access</h2>
            </div>
            <span className="pill">Enabled</span>
          </div>
          <div className="settings-list">
            <div>
              <span>Your role</span>
              <strong>{membership.role}</strong>
            </div>
            <div>
              <span>Access from</span>
              <strong>App, Slack, Telegram</strong>
            </div>
            <div>
              <span>Capabilities</span>
              <strong>{canManage ? "Read, write, edit" : "Read only"}</strong>
            </div>
          </div>
        </article>

        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Controls</p>
              <h2>Request handling</h2>
            </div>
          </div>
          <p className="muted">
            AI Agent requests can start from the app, Slack, or Telegram. Replies use the same context and saved learnings.
          </p>
          <div className="settings-list">
            <div>
              <span>Changes</span>
              <strong>Confirmation required</strong>
            </div>
            <div>
              <span>Activity</span>
              <strong>Saved before replies</strong>
            </div>
          </div>
        </article>

        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Chat</p>
              <h2>Ask the AI Agent</h2>
            </div>
            <span className="pill">App</span>
          </div>
          <div className="agent-chat-log" aria-live="polite">
            {messages?.length ? (
              messages.map((entry) => (
                <div
                  className={`agent-chat-message ${entry.direction === "outbound" ? "agent-chat-message-assistant" : "agent-chat-message-user"}`}
                  key={entry.id}
                >
                  <span>{entry.direction === "outbound" ? "Agent" : "You"}</span>
                  <p>{entry.body}</p>
                  <small>{formatDate(entry.created_at)}</small>
                </div>
              ))
            ) : (
              <p className="muted">Ask a question to start the conversation.</p>
            )}
          </div>
          <form action={createWebAgentRequestAction} className="agent-request-form">
            <label>
              <span>Mode</span>
              <select name="operation" defaultValue="operate">
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="edit">Edit</option>
                <option value="operate">Auto</option>
              </select>
            </label>
            <label>
              <span>Request</span>
              <textarea
                name="requestText"
                rows={4}
                placeholder="Ask about metrics, billing status, saved learnings, or what changed recently."
                required
              />
            </label>
            <button type="submit">
              Send
            </button>
          </form>
        </article>

        {canManage ? (
          <article className="settings-panel full-span">
            <div className="panel-heading">
              <div>
                <p className="step-label">Approvals</p>
                <h2>Pending confirmations</h2>
              </div>
              <span className="pill">{approvals?.length ?? 0} pending</span>
            </div>
            <div className="table-list">
              {approvals?.length ? (
                approvals.map((approval) => (
                  <div className="table-row" key={approval.id}>
                    <div>
                      <strong>{approval.action_type ?? "Confirmation"}</strong>
                      <span className="muted">
                        {approval.decision_notes ?? "Review required"} · {formatDate(approval.created_at)}
                      </span>
                    </div>
                    <div className="agent-approval-actions">
                      <form action={approveAgentApprovalAction}>
                        <input type="hidden" name="approvalId" value={approval.id} />
                        <button type="submit">Approve</button>
                      </form>
                      <form action={rejectAgentApprovalAction}>
                        <input type="hidden" name="approvalId" value={approval.id} />
                        <button type="submit">Reject</button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No pending confirmations.</p>
              )}
            </div>
          </article>
        ) : null}

        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Learning</p>
              <h2>Save a learning</h2>
            </div>
            <span className="pill">Manual</span>
          </div>
          <form action={saveAgentLearningAction} className="agent-request-form">
            <label>
              <span>Title</span>
              <input name="title" placeholder="What should the AI Agent remember?" disabled={!canManage} />
            </label>
            <label>
              <span>Learning</span>
              <textarea
                name="body"
                rows={4}
                placeholder="Add context, rules, examples, or preferences the AI Agent should use."
                disabled={!canManage}
                required
              />
            </label>
            <button type="submit" disabled={!canManage}>
              Save learning
            </button>
          </form>
        </article>

        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Recent</p>
              <h2>AI Agent requests</h2>
            </div>
            <span className="pill">{requests?.length ?? 0} shown</span>
          </div>
          <div className="table-list">
            {requests?.length ? (
              requests.map((request) => (
                <div className="table-row" key={request.id}>
                  <div>
                    <strong>{request.request_text}</strong>
                    <span className="muted">
                      {request.provider ?? "web"} · {requestOperation(request.metadata, request.risk_level)} · {formatDate(request.created_at)}
                    </span>
                  </div>
                  <span className="pill">{request.status}</span>
                </div>
              ))
            ) : (
              <p className="muted">No agent requests yet.</p>
            )}
          </div>
        </article>

        <article className="settings-panel full-span">
          <div className="panel-heading">
            <div>
              <p className="step-label">Memory</p>
              <h2>Saved learnings</h2>
            </div>
            <span className="pill">{learnings?.length ?? 0} shown</span>
          </div>
          <div className="table-list">
            {learnings?.length ? (
              learnings.map((learning) => (
                <div className="table-row" key={learning.id}>
                  <div>
                    <strong>{learning.title}</strong>
                    <span className="muted">
                      {learning.source_provider ?? "web"} · {formatDate(learning.updated_at)}
                    </span>
                    <p className="muted">{learning.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No saved learnings yet.</p>
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
