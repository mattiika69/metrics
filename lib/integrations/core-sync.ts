import { createHash } from "node:crypto";
import { calculateAndStoreMetricSnapshots } from "@/lib/metrics/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SyncResult = {
  provider: string;
  rowsRead: number;
  rowsWritten: number;
  message: string;
};

function hashId(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function textSecret(values: Record<string, unknown> | null | undefined, key: string) {
  const value = values?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadSecret(tenantId: string, provider: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("metric_integration_secrets")
    .select("secret_values")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.secret_values as Record<string, unknown> | null;
}

async function startRun(tenantId: string, provider: string, actorUserId?: string | null) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("metric_sync_runs")
    .insert({
      tenant_id: tenantId,
      provider,
      status: "started",
      created_by: actorUserId ?? null,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

async function completeRun(runId: string | undefined, result: SyncResult) {
  if (!runId) return;
  const admin = createAdminClient();
  await admin
    .from("metric_sync_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      rows_read: result.rowsRead,
      rows_written: result.rowsWritten,
      metadata: { message: result.message },
    })
    .eq("id", runId);
}

async function failRun(runId: string | undefined, error: unknown) {
  if (!runId) return;
  const admin = createAdminClient();
  await admin
    .from("metric_sync_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Sync failed",
    })
    .eq("id", runId);
}

async function syncStripe(tenantId: string): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, "stripe");
  const apiKey = textSecret(secret, "apiKey");
  if (!apiKey) throw new Error("Stripe restricted API key is required.");

  const response = await fetch("https://api.stripe.com/v1/charges?limit=100", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Stripe sync failed: ${response.status}`);
  const payload = await response.json() as { data?: Array<Record<string, unknown>> };
  const charges = payload.data ?? [];
  const admin = createAdminClient();
  const rows = charges.map((charge) => {
    const billing = charge.billing_details as Record<string, unknown> | undefined;
    const created = typeof charge.created === "number" ? charge.created : Math.floor(Date.now() / 1000);
    const id = String(charge.id);
    const email = typeof billing?.email === "string" ? billing.email : null;
    const name = typeof billing?.name === "string" ? billing.name : null;
    return {
      id: `stripe:${id}`,
      tenant_id: tenantId,
      source: "stripe",
      source_id: id,
      customer_email: email,
      customer_name: name,
      amount_cents: Number(charge.amount ?? 0),
      refunded_amount_cents: Number(charge.amount_refunded ?? 0),
      currency: typeof charge.currency === "string" ? charge.currency : "usd",
      status: typeof charge.status === "string" ? charge.status : "unknown",
      payment_date: new Date(created * 1000).toISOString(),
      description: typeof charge.description === "string" ? charge.description : null,
      is_subscription: Boolean(charge.invoice),
      provider_customer_id: typeof charge.customer === "string" ? charge.customer : null,
      raw_data: charge,
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) {
    const { error } = await admin.from("normalized_payments").upsert(rows, { onConflict: "tenant_id,source,source_id" });
    if (error) throw new Error(error.message);
    const clientRows = rows
      .filter((row) => row.customer_email)
      .map((row) => ({
        tenant_id: tenantId,
        email: row.customer_email,
        name: row.customer_name,
        first_payment_date: row.payment_date.slice(0, 10),
        status_end: "active",
        raw_data: { source: "stripe" },
        updated_at: new Date().toISOString(),
      }));
    if (clientRows.length) {
      await admin.from("client_records").upsert(clientRows, { onConflict: "tenant_id,email" });
    }
  }
  return { provider: "stripe", rowsRead: charges.length, rowsWritten: rows.length, message: "Stripe charges synced." };
}

async function syncCalendly(tenantId: string): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, "calendly");
  const accessToken = textSecret(secret, "accessToken");
  if (!accessToken) throw new Error("Calendly access token is required.");

  const meResponse = await fetch("https://api.calendly.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meResponse.ok) throw new Error(`Calendly user lookup failed: ${meResponse.status}`);
  const me = await meResponse.json() as { resource?: { uri?: string } };
  const userUri = me.resource?.uri;
  if (!userUri) throw new Error("Calendly user URI could not be resolved.");
  const eventsResponse = await fetch(`https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}&count=100&sort=start_time:desc`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!eventsResponse.ok) throw new Error(`Calendly event sync failed: ${eventsResponse.status}`);
  const payload = await eventsResponse.json() as { collection?: Array<Record<string, unknown>> };
  const events = payload.collection ?? [];
  const rows = events.map((event) => {
    const uri = String(event.uri ?? event.uuid ?? hashId(JSON.stringify(event)));
    const status = String(event.status ?? "booked").toLowerCase();
    return {
      id: `calendly:${hashId(uri)}`,
      tenant_id: tenantId,
      source: "calendly",
      source_id: uri,
      event_date: typeof event.start_time === "string" ? event.start_time : new Date().toISOString(),
      contact_name: typeof event.name === "string" ? event.name : null,
      status: status === "active" ? "booked" : status,
      is_qualified: true,
      offer_sent: false,
      raw_data: event,
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) {
    const { error } = await createAdminClient().from("sales_events").upsert(rows, { onConflict: "tenant_id,source,source_id" });
    if (error) throw new Error(error.message);
  }
  return { provider: "calendly", rowsRead: events.length, rowsWritten: rows.length, message: "Calendly scheduled events synced." };
}

function answerValue(answer: Record<string, unknown>) {
  for (const key of ["email", "phone_number", "text", "number", "choice"]) {
    const value = answer[key];
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "label" in value) return String((value as { label?: unknown }).label ?? "");
  }
  return "";
}

async function syncTypeform(tenantId: string): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, "typeform");
  const accessToken = textSecret(secret, "accessToken");
  if (!accessToken) throw new Error("Typeform access token is required.");
  const formId = textSecret(secret, "formId");
  const headers = { Authorization: `Bearer ${accessToken}` };
  const formIds: string[] = [];

  if (formId) {
    formIds.push(formId);
  } else {
    const formsResponse = await fetch("https://api.typeform.com/forms?page_size=10", { headers });
    if (!formsResponse.ok) throw new Error(`Typeform forms lookup failed: ${formsResponse.status}`);
    const forms = await formsResponse.json() as { items?: Array<{ id?: string }> };
    formIds.push(...(forms.items ?? []).map((form) => form.id).filter(Boolean) as string[]);
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const id of formIds.slice(0, 5)) {
    const response = await fetch(`https://api.typeform.com/forms/${id}/responses?page_size=100`, { headers });
    if (!response.ok) continue;
    const payload = await response.json() as { items?: Array<Record<string, unknown>> };
    for (const item of payload.items ?? []) {
      const answers = Array.isArray(item.answers) ? item.answers as Record<string, unknown>[] : [];
      const values = answers.map(answerValue).filter(Boolean);
      const email = values.find((value) => /@/.test(value)) ?? null;
      const phone = values.find((value) => /^[+()\d\s-]{7,}$/.test(value)) ?? null;
      rows.push({
        id: `typeform:${id}:${String(item.response_id ?? hashId(JSON.stringify(item)))}`,
        tenant_id: tenantId,
        source: "typeform",
        source_id: String(item.response_id ?? hashId(JSON.stringify(item))),
        submitted_at: typeof item.submitted_at === "string" ? item.submitted_at : new Date().toISOString(),
        name: values.find((value) => value !== email && value !== phone) ?? null,
        email,
        phone,
        raw_data: item,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (rows.length) {
    const { error } = await createAdminClient().from("form_leads").upsert(rows, { onConflict: "tenant_id,source,source_id" });
    if (error) throw new Error(error.message);
  }
  return { provider: "typeform", rowsRead: rows.length, rowsWritten: rows.length, message: "Typeform responses synced." };
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

export async function importCsvBanking({
  tenantId,
  csvText,
  actorUserId,
}: {
  tenantId: string;
  csvText: string;
  actorUserId?: string | null;
}) {
  const provider = "csv-banking";
  const runId = await startRun(tenantId, provider, actorUserId);
  try {
    const records = parseCsv(csvText);
    const rows = records.map((record) => {
      const date = record.date || record.transaction_date || record.posted_at || new Date().toISOString().slice(0, 10);
      const amount = Number(record.amount || 0);
      const direction = record.direction || (amount >= 0 ? "inbound" : "outbound");
      const sourceId = record.transaction_id || hashId(`${tenantId}:${date}:${record.name}:${amount}:${JSON.stringify(record)}`);
      return {
        id: `csv:${tenantId}:${sourceId}`,
        tenant_id: tenantId,
        source: "csv-banking",
        transaction_id: sourceId,
        amount: Math.abs(amount),
        direction,
        transaction_date: date,
        name: record.name || record.description || null,
        category: record.category || null,
        cost_type: record.cost_type || null,
        is_acquisition: ["true", "yes", "1"].includes(String(record.is_acquisition ?? "").toLowerCase()),
        is_waste: ["true", "yes", "1"].includes(String(record.is_waste ?? "").toLowerCase()),
        is_recurring: ["true", "yes", "1"].includes(String(record.is_recurring ?? "").toLowerCase()),
        is_new_client_revenue: ["true", "yes", "1"].includes(String(record.is_new_client_revenue ?? "").toLowerCase()),
        raw_data: record,
        updated_at: new Date().toISOString(),
      };
    });
    if (rows.length) {
      const { error } = await createAdminClient().from("bank_transactions").upsert(rows, { onConflict: "tenant_id,source,transaction_id" });
      if (error) throw new Error(error.message);
    }
    const result = { provider, rowsRead: records.length, rowsWritten: rows.length, message: "CSV banking rows imported." };
    await completeRun(runId, result);
    await calculateAndStoreMetricSnapshots({ tenantId, periodKey: "30d" });
    return result;
  } catch (error) {
    await failRun(runId, error);
    throw error;
  }
}

export async function syncCoreIntegration({
  tenantId,
  provider,
  actorUserId,
}: {
  tenantId: string;
  provider: string;
  actorUserId?: string | null;
}) {
  const runId = await startRun(tenantId, provider, actorUserId);
  try {
    let result: SyncResult;
    if (provider === "stripe") result = await syncStripe(tenantId);
    else if (provider === "calendly") result = await syncCalendly(tenantId);
    else if (provider === "typeform") result = await syncTypeform(tenantId);
    else {
      result = {
        provider,
        rowsRead: 0,
        rowsWritten: 0,
        message: "Connection is tracked. Live ingestion is not enabled for this provider yet.",
      };
    }
    await completeRun(runId, result);
    await calculateAndStoreMetricSnapshots({ tenantId, periodKey: "30d" });
    return result;
  } catch (error) {
    await failRun(runId, error);
    throw error;
  }
}
