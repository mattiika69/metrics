export type IntegrationField = {
  name: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
};

export type IntegrationDefinition = {
  id: string;
  name: string;
  group: "Payment Processors" | "Banking" | "Sales Calls" | "Forms/Leads" | "Social Inputs" | "Messaging";
  description: string;
  fields: IntegrationField[];
  comingSoon?: boolean;
};

export const integrationCatalog: IntegrationDefinition[] = [
  { id: "stripe", name: "Stripe", group: "Payment Processors", description: "Track payments, MRR, revenue, churn inputs, and median payment.", fields: [{ name: "apiKey", label: "Restricted API Key", type: "password", placeholder: "rk_live_..." }] },
  { id: "whop", name: "Whop", group: "Payment Processors", description: "Track membership payments and subscription revenue.", fields: [{ name: "apiKey", label: "Company API Key", type: "password", placeholder: "whop_ak_..." }] },
  { id: "fanbasis", name: "Fanbasis", group: "Payment Processors", description: "Track payments and customer revenue from Fanbasis.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste Fanbasis API key" }] },
  { id: "plaid", name: "Plaid", group: "Banking", description: "Track account balances, cash in, cash out, and categorized spend.", fields: [{ name: "accessToken", label: "Access Token", type: "password", placeholder: "access-sandbox-..." }] },
  { id: "csv-banking", name: "CSV Banking", group: "Banking", description: "Connect imported banking files as the source for cash and cost metrics.", fields: [] },
  { id: "quickbooks", name: "QuickBooks", group: "Banking", description: "Accounting sync for invoices, payments, and banking.", fields: [], comingSoon: true },
  { id: "calendly", name: "Calendly", group: "Sales Calls", description: "Track booked calls, show rate, and sales outcomes.", fields: [{ name: "accessToken", label: "Personal Access Token", type: "password", placeholder: "eyJ..." }] },
  { id: "calcom", name: "Cal.com", group: "Sales Calls", description: "Track booked calls and sales call outcomes from Cal.com.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "cal_live_..." }] },
  { id: "iclosed", name: "iClosed", group: "Sales Calls", description: "Track sales call status and close-rate metrics.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }] },
  { id: "readai", name: "Read.ai", group: "Sales Calls", description: "Import call summaries and recordings for source trace.", fields: [{ name: "webhookName", label: "Webhook Name", type: "text", placeholder: "Sales calls" }] },
  { id: "fathom", name: "Fathom", group: "Sales Calls", description: "Import call recordings and meeting summaries.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }] },
  { id: "fireflies", name: "Fireflies", group: "Sales Calls", description: "Import call notes, summaries, and recordings.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }] },
  { id: "typeform", name: "Typeform", group: "Forms/Leads", description: "Track form leads and submitted sales inputs.", fields: [{ name: "accessToken", label: "Access Token", type: "password", placeholder: "tfp_..." }] },
  { id: "heyflow", name: "Heyflow", group: "Forms/Leads", description: "Track submitted leads from Heyflow funnels.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }] },
  { id: "paid-ads", name: "Paid Ads", group: "Social Inputs", description: "Connect ad account exports, report URLs, or scrape-ready account links.", fields: [{ name: "accountUrl", label: "Account or Report URL", type: "text", placeholder: "https://..." }] },
  { id: "cold-email", name: "Cold Email", group: "Forms/Leads", description: "Connect cold email account exports, RSS feeds, or scrape-ready source links.", fields: [{ name: "accountUrl", label: "Account or Feed URL", type: "text", placeholder: "https://..." }] },
  { id: "newsletter", name: "Newsletter", group: "Forms/Leads", description: "Connect newsletter account exports, RSS feeds, or scrape-ready source links.", fields: [{ name: "accountUrl", label: "Account or RSS URL", type: "text", placeholder: "https://..." }] },
  { id: "linkedin", name: "LinkedIn", group: "Social Inputs", description: "Track posts and engagement inputs.", fields: [{ name: "accessToken", label: "Access Token", type: "password", placeholder: "Paste token" }] },
  { id: "twitter", name: "X / Twitter", group: "Social Inputs", description: "Track posts, views, and engagement inputs.", fields: [{ name: "bearerToken", label: "Bearer Token", type: "password", placeholder: "AAAA..." }] },
  { id: "instagram", name: "Instagram", group: "Social Inputs", description: "Track posts and engagement inputs.", fields: [{ name: "accessToken", label: "Access Token", type: "password", placeholder: "Paste token" }] },
  { id: "facebook", name: "Facebook", group: "Social Inputs", description: "Track posts and engagement inputs.", fields: [{ name: "pageAccessToken", label: "Page Access Token", type: "password", placeholder: "Paste token" }] },
  { id: "slack", name: "Slack", group: "Messaging", description: "Use metrics, constraints, forecast, and department commands from Slack.", fields: [] },
  { id: "telegram", name: "Telegram", group: "Messaging", description: "Use metrics, constraints, forecast, and department commands from Telegram.", fields: [] },
];

export const integrationGroups = [
  "Payment Processors",
  "Banking",
  "Sales Calls",
  "Forms/Leads",
  "Social Inputs",
  "Messaging",
] as const;

export function getIntegrationDefinition(id: string) {
  return integrationCatalog.find((integration) => integration.id === id) ?? null;
}
