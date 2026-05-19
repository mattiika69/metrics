import "server-only";

import { createHash } from "node:crypto";
import { loadMetricIntegrationSecret } from "@/lib/integrations/secret-store";
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

function textFromXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function xmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? textFromXml(match[1]) : null;
}

function parseFeedItems(text: string) {
  const blocks = text.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((block, index) => {
    const title = xmlTag(block, "title");
    const link = xmlTag(block, "link") ?? block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
    const published = xmlTag(block, "pubDate") ?? xmlTag(block, "published") ?? xmlTag(block, "updated");
    const body = xmlTag(block, "description") ?? xmlTag(block, "summary") ?? xmlTag(block, "content");
    const id = xmlTag(block, "guid") ?? xmlTag(block, "id") ?? link ?? `${title ?? "feed"}:${index}`;
    return { id, title, link, published, body };
  });
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[$,]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function firstNestedString(record: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    let value: unknown = record;
    for (const key of path) {
      value = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
    }
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function extractRecords(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
    }
  }
  const nested = record.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return extractRecords(nested, keys);
  }
  return [];
}

function authHeaders(secret: Record<string, unknown> | null): Record<string, string> {
  const token = textSecret(secret, "apiKey")
    ?? textSecret(secret, "accessToken")
    ?? textSecret(secret, "bearerToken")
    ?? textSecret(secret, "pageAccessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJsonEndpoint(url: string, secret: Record<string, unknown> | null) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...authHeaders(secret),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `Sync failed: ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function loadSecret(tenantId: string, provider: string) {
  return loadMetricIntegrationSecret({ tenantId, provider });
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

async function syncPaymentProvider(tenantId: string, provider: "whop" | "fanbasis"): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, provider);
  const apiUrl = textSecret(secret, "apiUrl") ?? (provider === "whop" ? "https://api.whop.com/api/v2/payments" : null);
  if (!apiUrl) throw new Error(`${provider === "whop" ? "Whop" : "Fanbasis"} payments API URL is required.`);

  const payload = await fetchJsonEndpoint(apiUrl, secret);
  const payments = extractRecords(payload, ["data", "payments", "transactions", "orders", "items", "results"]);
  const admin = createAdminClient();
  const rows = payments.map((payment) => {
    const id = firstString(payment, ["id", "payment_id", "transaction_id", "order_id", "uuid"]) ?? hashId(JSON.stringify(payment));
    const amountCents = firstNumber(payment, ["amount_cents", "total_cents", "price_cents"])
      ?? Math.round((firstNumber(payment, ["amount", "total", "price", "revenue"]) ?? 0) * 100);
    const email = firstString(payment, ["customer_email", "email", "buyer_email"])
      ?? firstNestedString(payment, [["customer", "email"], ["buyer", "email"], ["user", "email"]]);
    const name = firstString(payment, ["customer_name", "name", "buyer_name"])
      ?? firstNestedString(payment, [["customer", "name"], ["buyer", "name"], ["user", "name"]]);
    const status = firstString(payment, ["status", "payment_status", "state"]) ?? "paid";
    return {
      id: `${provider}:${id}`,
      tenant_id: tenantId,
      source: provider,
      source_id: id,
      customer_email: email,
      customer_name: name,
      amount_cents: amountCents,
      refunded_amount_cents: firstNumber(payment, ["refunded_amount_cents", "amount_refunded_cents"]) ?? 0,
      currency: (firstString(payment, ["currency"]) ?? "usd").toLowerCase(),
      status,
      payment_date: parseDate(payment.created_at ?? payment.createdAt ?? payment.paid_at ?? payment.date),
      description: firstString(payment, ["description", "product_name", "title"]),
      is_subscription: Boolean(payment.subscription_id ?? payment.membership_id ?? payment.recurring),
      provider_customer_id: firstString(payment, ["customer_id", "buyer_id", "user_id"]),
      provider_subscription_id: firstString(payment, ["subscription_id", "membership_id"]),
      raw_data: payment,
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
        raw_data: { source: provider },
        updated_at: new Date().toISOString(),
      }));
    if (clientRows.length) {
      await admin.from("client_records").upsert(clientRows, { onConflict: "tenant_id,email" });
    }
  }

  return {
    provider,
    rowsRead: payments.length,
    rowsWritten: rows.length,
    message: `${provider === "whop" ? "Whop" : "Fanbasis"} payments synced.`,
  };
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

async function syncSalesCallProvider(tenantId: string, provider: "calcom" | "iclosed"): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, provider);
  const apiUrl = textSecret(secret, "apiUrl") ?? (provider === "calcom" ? "https://api.cal.com/v2/bookings?limit=100" : null);
  if (!apiUrl) throw new Error(`${provider === "calcom" ? "Cal.com" : "iClosed"} calls API URL is required.`);

  const payload = await fetchJsonEndpoint(apiUrl, secret);
  const events = extractRecords(payload, ["data", "bookings", "calls", "events", "items", "results"]);
  const rows = events.map((event) => {
    const id = firstString(event, ["id", "uid", "uuid", "booking_id", "event_id"]) ?? hashId(JSON.stringify(event));
    const status = (firstString(event, ["status", "state", "call_status"]) ?? "booked").toLowerCase();
    const email = firstString(event, ["email", "contact_email", "attendee_email"])
      ?? firstNestedString(event, [["attendees", "0", "email"], ["customer", "email"], ["lead", "email"]]);
    const name = firstString(event, ["name", "title", "contact_name", "attendee_name"])
      ?? firstNestedString(event, [["customer", "name"], ["lead", "name"]]);
    return {
      id: `${provider}:${id}`,
      tenant_id: tenantId,
      source: provider,
      source_id: id,
      event_date: parseDate(event.start_time ?? event.startTime ?? event.scheduled_at ?? event.created_at ?? event.date),
      contact_email: email,
      contact_name: name,
      status: status.includes("cancel") ? "cancelled" : status.includes("show") || status.includes("completed") ? "shown" : status,
      is_qualified: !status.includes("unqualified"),
      offer_sent: Boolean(event.offer_sent ?? event.offerSent),
      closer: firstString(event, ["closer", "owner", "host"]),
      channel: provider,
      raw_data: event,
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length) {
    const { error } = await createAdminClient().from("sales_events").upsert(rows, { onConflict: "tenant_id,source,source_id" });
    if (error) throw new Error(error.message);
  }
  return {
    provider,
    rowsRead: events.length,
    rowsWritten: rows.length,
    message: `${provider === "calcom" ? "Cal.com" : "iClosed"} calls synced.`,
  };
}

function plaidBaseUrl(environment: string | null) {
  if (environment === "production") return "https://production.plaid.com";
  if (environment === "development") return "https://development.plaid.com";
  return "https://sandbox.plaid.com";
}

async function syncPlaid(tenantId: string): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, "plaid");
  const clientId = textSecret(secret, "clientId");
  const plaidSecret = textSecret(secret, "secret");
  const accessToken = textSecret(secret, "accessToken");
  const environment = textSecret(secret, "environment") ?? "sandbox";
  if (!clientId || !plaidSecret || !accessToken) {
    throw new Error("Plaid client ID, secret, and access token are required.");
  }

  const endDate = new Date();
  const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);
  const response = await fetch(`${plaidBaseUrl(environment)}/transactions/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      secret: plaidSecret,
      access_token: accessToken,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      options: { count: 500, offset: 0 },
    }),
  });
  const payload = await response.json().catch(() => ({})) as {
    transactions?: Array<Record<string, unknown>>;
    accounts?: Array<Record<string, unknown>>;
    error_message?: string;
  };
  if (!response.ok) throw new Error(payload.error_message ?? `Plaid sync failed: ${response.status}`);

  const accountById = new Map((payload.accounts ?? []).map((account) => [String(account.account_id), account]));
  const rows = (payload.transactions ?? []).map((transaction) => {
    const id = String(transaction.transaction_id ?? hashId(JSON.stringify(transaction)));
    const amount = Number(transaction.amount ?? 0);
    const account = accountById.get(String(transaction.account_id));
    const category = Array.isArray(transaction.category)
      ? transaction.category.filter((value) => typeof value === "string").join(" / ")
      : typeof transaction.personal_finance_category === "object" && transaction.personal_finance_category
        ? String((transaction.personal_finance_category as { primary?: unknown }).primary ?? "")
        : null;
    return {
      id: `plaid:${id}`,
      tenant_id: tenantId,
      source: "plaid",
      transaction_id: id,
      amount: Math.abs(amount),
      direction: amount > 0 ? "outbound" : "inbound",
      transaction_date: typeof transaction.date === "string" ? transaction.date : new Date().toISOString().slice(0, 10),
      name: typeof transaction.name === "string" ? transaction.name : null,
      category,
      raw_data: {
        ...transaction,
        account_name: typeof account?.name === "string" ? account.name : null,
        account_mask: typeof account?.mask === "string" ? account.mask : null,
      },
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length) {
    const { error } = await createAdminClient().from("bank_transactions").upsert(rows, { onConflict: "tenant_id,source,transaction_id" });
    if (error) throw new Error(error.message);
  }

  return {
    provider: "plaid",
    rowsRead: payload.transactions?.length ?? 0,
    rowsWritten: rows.length,
    message: "Plaid transactions synced.",
  };
}

function quickBooksBaseUrl(environment: string | null) {
  return environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

async function syncQuickBooks(tenantId: string): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, "quickbooks");
  const accessToken = textSecret(secret, "accessToken");
  const realmId = textSecret(secret, "realmId");
  const environment = textSecret(secret, "environment") ?? "sandbox";
  if (!accessToken || !realmId) throw new Error("QuickBooks access token and company ID are required.");

  const query = encodeURIComponent("select * from Purchase maxresults 100");
  const response = await fetch(`${quickBooksBaseUrl(environment)}/v3/company/${realmId}/query?query=${query}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as {
    QueryResponse?: { Purchase?: Array<Record<string, unknown>> };
    Fault?: { Error?: Array<{ Message?: string }> };
  };
  if (!response.ok) throw new Error(payload.Fault?.Error?.[0]?.Message ?? `QuickBooks sync failed: ${response.status}`);

  const purchases = payload.QueryResponse?.Purchase ?? [];
  const rows = purchases.map((purchase) => {
    const id = String(purchase.Id ?? hashId(JSON.stringify(purchase)));
    const amount = Number(purchase.TotalAmt ?? purchase.Amount ?? 0);
    return {
      id: `quickbooks:${id}`,
      tenant_id: tenantId,
      source: "quickbooks",
      transaction_id: id,
      amount: Math.abs(amount),
      direction: "outbound",
      transaction_date: parseDate(purchase.TxnDate).slice(0, 10),
      name: firstString(purchase, ["DocNumber", "PrivateNote"]) ?? firstNestedString(purchase, [["EntityRef", "name"]]),
      category: firstNestedString(purchase, [["AccountRef", "name"]]),
      raw_data: purchase,
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length) {
    const { error } = await createAdminClient().from("bank_transactions").upsert(rows, { onConflict: "tenant_id,source,transaction_id" });
    if (error) throw new Error(error.message);
  }
  return { provider: "quickbooks", rowsRead: purchases.length, rowsWritten: rows.length, message: "QuickBooks purchases synced." };
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

async function syncLeadProvider(tenantId: string, provider: "heyflow"): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, provider);
  const apiUrl = textSecret(secret, "apiUrl");
  if (!apiUrl) throw new Error("Heyflow submissions API URL is required.");

  const payload = await fetchJsonEndpoint(apiUrl, secret);
  const leads = extractRecords(payload, ["data", "submissions", "responses", "leads", "items", "results"]);
  const rows = leads.map((lead) => {
    const id = firstString(lead, ["id", "submission_id", "response_id", "uuid"]) ?? hashId(JSON.stringify(lead));
    return {
      id: `${provider}:${id}`,
      tenant_id: tenantId,
      source: provider,
      source_id: id,
      submitted_at: parseDate(lead.submitted_at ?? lead.created_at ?? lead.createdAt ?? lead.date),
      name: firstString(lead, ["name", "full_name", "first_name"]),
      email: firstString(lead, ["email", "customer_email"]),
      phone: firstString(lead, ["phone", "phone_number"]),
      raw_data: lead,
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) {
    const { error } = await createAdminClient().from("form_leads").upsert(rows, { onConflict: "tenant_id,source,source_id" });
    if (error) throw new Error(error.message);
  }
  return { provider, rowsRead: leads.length, rowsWritten: rows.length, message: "Heyflow submissions synced." };
}

async function syncCallRecordingProvider(tenantId: string, provider: "readai" | "fathom" | "fireflies"): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, provider);
  const apiUrl = textSecret(secret, "apiUrl");
  if (!apiUrl) throw new Error(`${provider === "readai" ? "Read.ai" : provider === "fathom" ? "Fathom" : "Fireflies"} recordings API URL is required.`);

  const payload = await fetchJsonEndpoint(apiUrl, secret);
  const recordings = extractRecords(payload, ["data", "meetings", "recordings", "calls", "transcripts", "items", "results"]);
  const admin = createAdminClient();
  const rows = recordings.map((recording) => {
    const id = firstString(recording, ["id", "meeting_id", "recording_id", "uuid"]) ?? hashId(JSON.stringify(recording));
    return {
      id: `${provider}:${id}`,
      tenant_id: tenantId,
      source: provider,
      source_id: id,
      recorded_at: parseDate(recording.recorded_at ?? recording.started_at ?? recording.start_time ?? recording.created_at ?? recording.date),
      title: firstString(recording, ["title", "name", "meeting_title"]),
      summary: firstString(recording, ["summary", "notes", "transcript_summary"]),
      recording_url: firstString(recording, ["recording_url", "video_url", "audio_url", "url"]),
      contact_email: firstString(recording, ["contact_email", "email", "attendee_email"]),
      raw_data: recording,
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) {
    const { error } = await admin.from("call_recordings").upsert(rows, { onConflict: "tenant_id,source,source_id" });
    if (error) throw new Error(error.message);

    const salesRows = rows.map((row) => ({
      id: `${provider}:sales:${row.source_id}`,
      tenant_id: tenantId,
      source: provider,
      source_id: row.source_id,
      event_date: row.recorded_at,
      contact_email: row.contact_email,
      contact_name: row.title,
      status: "shown",
      is_qualified: true,
      offer_sent: false,
      channel: provider,
      raw_data: row.raw_data,
      updated_at: new Date().toISOString(),
    }));
    await admin.from("sales_events").upsert(salesRows, { onConflict: "tenant_id,source,source_id" });
  }
  return {
    provider,
    rowsRead: recordings.length,
    rowsWritten: rows.length,
    message: `${provider === "readai" ? "Read.ai" : provider === "fathom" ? "Fathom" : "Fireflies"} recordings synced.`,
  };
}

async function syncSocialProvider(tenantId: string, provider: "linkedin" | "twitter" | "instagram" | "facebook"): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, provider);
  const apiUrl = textSecret(secret, "apiUrl");
  if (!apiUrl) throw new Error(`${provider === "twitter" ? "X / Twitter" : provider} posts API URL is required.`);

  const payload = await fetchJsonEndpoint(apiUrl, secret);
  const posts = extractRecords(payload, ["data", "posts", "tweets", "media", "items", "results"]);
  const rows = posts.map((post) => {
    const id = firstString(post, ["id", "post_id", "tweet_id", "media_id", "urn"]) ?? hashId(JSON.stringify(post));
    const metrics = (post.metrics ?? post.public_metrics ?? post.insights ?? {}) as Record<string, unknown>;
    return {
      id: `${provider}:${id}`,
      tenant_id: tenantId,
      source: provider,
      source_id: id,
      posted_at: parseDate(post.posted_at ?? post.created_at ?? post.createdAt ?? post.timestamp),
      content: firstString(post, ["text", "caption", "content", "message", "body"]),
      views: firstNumber(post, ["views", "impressions"]) ?? firstNumber(metrics, ["views", "impressions"]) ?? 0,
      likes: firstNumber(post, ["likes", "like_count"]) ?? firstNumber(metrics, ["likes", "like_count"]) ?? 0,
      comments: firstNumber(post, ["comments", "comment_count", "replies"]) ?? firstNumber(metrics, ["comments", "comment_count", "reply_count"]) ?? 0,
      shares: firstNumber(post, ["shares", "share_count", "retweets"]) ?? firstNumber(metrics, ["shares", "share_count", "retweet_count"]) ?? 0,
      raw_data: post,
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) {
    const { error } = await createAdminClient().from("social_posts").upsert(rows, { onConflict: "tenant_id,source,source_id" });
    if (error) throw new Error(error.message);
  }
  return { provider, rowsRead: posts.length, rowsWritten: rows.length, message: `${provider} posts synced.` };
}

async function syncFeedInput(tenantId: string, provider: "cold-email" | "newsletter" | "paid-ads"): Promise<SyncResult> {
  const secret = await loadSecret(tenantId, provider);
  const accountUrl = textSecret(secret, "accountUrl");
  if (!accountUrl) throw new Error("Account or feed URL is required.");

  const response = await fetch(accountUrl, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, text/xml, text/html;q=0.8",
      "User-Agent": "HyperOptimalMetrics/1.0",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Source URL could not be read: ${response.status}`);

  const text = await response.text();
  const items = parseFeedItems(text);
  const admin = createAdminClient();

  if (provider === "paid-ads") {
    const rows = items.map((item) => ({
      id: `${provider}:${hashId(item.id)}`,
      tenant_id: tenantId,
      source: provider,
      source_id: item.id,
      posted_at: item.published ? new Date(item.published).toISOString() : new Date().toISOString(),
      content: [item.title, item.body, item.link].filter(Boolean).join("\n\n"),
      raw_data: item,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await admin.from("social_posts").upsert(rows, { onConflict: "tenant_id,source,source_id" });
      if (error) throw new Error(error.message);
    }
    return {
      provider,
      rowsRead: items.length,
      rowsWritten: rows.length,
      message: rows.length ? "Paid ads feed synced." : "Connection saved. No feed items were found at that URL.",
    };
  }

  const rows = items.map((item) => ({
    id: `${provider}:${hashId(item.id)}`,
    tenant_id: tenantId,
    source: provider,
    source_id: item.id,
    submitted_at: item.published ? new Date(item.published).toISOString() : new Date().toISOString(),
    name: item.title,
    email: item.body?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null,
    raw_data: item,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length) {
    const { error } = await admin.from("form_leads").upsert(rows, { onConflict: "tenant_id,source,source_id" });
    if (error) throw new Error(error.message);
  }
  return {
    provider,
    rowsRead: items.length,
    rowsWritten: rows.length,
    message: rows.length ? `${provider === "newsletter" ? "Newsletter" : "Cold email"} feed synced.` : "Connection saved. No feed items were found at that URL.",
  };
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
    else if (provider === "whop" || provider === "fanbasis") result = await syncPaymentProvider(tenantId, provider);
    else if (provider === "plaid") result = await syncPlaid(tenantId);
    else if (provider === "quickbooks") result = await syncQuickBooks(tenantId);
    else if (provider === "calendly") result = await syncCalendly(tenantId);
    else if (provider === "calcom" || provider === "iclosed") result = await syncSalesCallProvider(tenantId, provider);
    else if (provider === "typeform") result = await syncTypeform(tenantId);
    else if (provider === "heyflow") result = await syncLeadProvider(tenantId, provider);
    else if (provider === "readai" || provider === "fathom" || provider === "fireflies") {
      result = await syncCallRecordingProvider(tenantId, provider);
    }
    else if (provider === "linkedin" || provider === "twitter" || provider === "instagram" || provider === "facebook") {
      result = await syncSocialProvider(tenantId, provider);
    }
    else if (provider === "cold-email" || provider === "newsletter" || provider === "paid-ads") {
      result = await syncFeedInput(tenantId, provider);
    }
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
