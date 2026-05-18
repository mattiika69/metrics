export type IntegrationField = {
  name: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
  required?: boolean;
};

export type IntegrationDefinition = {
  id: string;
  name: string;
  group: "Payment Processors" | "Banking" | "Sales Calls" | "Forms/Leads" | "Social Inputs" | "Messaging";
  description: string;
  fields: IntegrationField[];
  comingSoon?: boolean;
};

export type IntegrationDetailLink = {
  label: string;
  href: string;
};

export type IntegrationDetailCopy = {
  accent: string;
  icon: string;
  setupTitle: string;
  setupSteps: string[];
  links: IntegrationDetailLink[];
  dataRead: string[];
  destination: string;
};

export const integrationCatalog: IntegrationDefinition[] = [
  { id: "stripe", name: "Stripe", group: "Payment Processors", description: "Track payments, MRR, revenue, churn inputs, and median payment.", fields: [{ name: "apiKey", label: "Restricted API Key", type: "password", placeholder: "rk_live_..." }] },
  { id: "whop", name: "Whop", group: "Payment Processors", description: "Track membership payments and subscription revenue.", fields: [{ name: "apiKey", label: "Company API Key", type: "password", placeholder: "whop_ak_..." }, { name: "apiUrl", label: "Payments API URL", type: "text", placeholder: "Optional custom payments endpoint", required: false }] },
  { id: "fanbasis", name: "Fanbasis", group: "Payment Processors", description: "Track payments and customer revenue from Fanbasis.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste Fanbasis API key" }, { name: "apiUrl", label: "Payments API URL", type: "text", placeholder: "Paste payments endpoint URL" }] },
  { id: "plaid", name: "Plaid", group: "Banking", description: "Track account balances, cash in, cash out, and categorized spend.", fields: [{ name: "clientId", label: "Client ID", type: "password", placeholder: "Plaid client ID" }, { name: "secret", label: "Secret", type: "password", placeholder: "Plaid secret" }, { name: "accessToken", label: "Access Token", type: "password", placeholder: "access-sandbox-..." }, { name: "environment", label: "Environment", type: "text", placeholder: "sandbox, development, or production", required: false }] },
  { id: "csv-banking", name: "CSV Banking", group: "Banking", description: "Connect imported banking files as the source for cash and cost metrics.", fields: [] },
  { id: "quickbooks", name: "QuickBooks", group: "Banking", description: "Accounting sync for invoices, payments, and banking.", fields: [{ name: "accessToken", label: "Access Token", type: "password", placeholder: "Paste QuickBooks access token" }, { name: "realmId", label: "Company ID", type: "text", placeholder: "QuickBooks realm ID" }, { name: "environment", label: "Environment", type: "text", placeholder: "sandbox or production", required: false }] },
  { id: "calendly", name: "Calendly", group: "Sales Calls", description: "Track booked calls, show rate, and sales outcomes.", fields: [{ name: "accessToken", label: "Personal Access Token", type: "password", placeholder: "eyJ..." }] },
  { id: "calcom", name: "Cal.com", group: "Sales Calls", description: "Track booked calls and sales call outcomes from Cal.com.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "cal_live_..." }, { name: "apiUrl", label: "Bookings API URL", type: "text", placeholder: "Optional custom bookings endpoint", required: false }] },
  { id: "iclosed", name: "iClosed", group: "Sales Calls", description: "Track sales call status and close-rate metrics.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }, { name: "apiUrl", label: "Calls API URL", type: "text", placeholder: "Paste calls endpoint URL" }] },
  { id: "readai", name: "Read.ai", group: "Sales Calls", description: "Import call summaries and recordings for source trace.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }, { name: "apiUrl", label: "Recordings API URL", type: "text", placeholder: "Paste recordings endpoint URL" }] },
  { id: "fathom", name: "Fathom", group: "Sales Calls", description: "Import call recordings and meeting summaries.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }, { name: "apiUrl", label: "Recordings API URL", type: "text", placeholder: "Paste recordings endpoint URL" }] },
  { id: "fireflies", name: "Fireflies", group: "Sales Calls", description: "Import call notes, summaries, and recordings.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }, { name: "apiUrl", label: "Recordings API URL", type: "text", placeholder: "Paste recordings endpoint URL" }] },
  { id: "typeform", name: "Typeform", group: "Forms/Leads", description: "Track form leads and submitted sales inputs.", fields: [{ name: "accessToken", label: "Access Token", type: "password", placeholder: "tfp_..." }, { name: "formId", label: "Form ID", type: "text", placeholder: "Optional specific form ID", required: false }] },
  { id: "heyflow", name: "Heyflow", group: "Forms/Leads", description: "Track submitted leads from Heyflow funnels.", fields: [{ name: "apiKey", label: "API Key", type: "password", placeholder: "Paste API key" }, { name: "apiUrl", label: "Submissions API URL", type: "text", placeholder: "Paste submissions endpoint URL" }] },
  { id: "paid-ads", name: "Paid Ads", group: "Social Inputs", description: "Connect ad account exports, report URLs, or scrape-ready account links.", fields: [{ name: "accountUrl", label: "Account or Report URL", type: "text", placeholder: "https://..." }] },
  { id: "cold-email", name: "Cold Email", group: "Forms/Leads", description: "Connect cold email account exports, RSS feeds, or scrape-ready source links.", fields: [{ name: "accountUrl", label: "Account or Feed URL", type: "text", placeholder: "https://..." }] },
  { id: "newsletter", name: "Newsletter", group: "Forms/Leads", description: "Connect newsletter account exports, RSS feeds, or scrape-ready source links.", fields: [{ name: "accountUrl", label: "Account or RSS URL", type: "text", placeholder: "https://..." }] },
  { id: "linkedin", name: "LinkedIn", group: "Social Inputs", description: "Track posts and engagement inputs.", fields: [{ name: "accessToken", label: "Access Token", type: "password", placeholder: "Paste token" }, { name: "apiUrl", label: "Posts API URL", type: "text", placeholder: "Paste posts endpoint URL" }] },
  { id: "twitter", name: "X / Twitter", group: "Social Inputs", description: "Track posts, views, and engagement inputs.", fields: [{ name: "bearerToken", label: "Bearer Token", type: "password", placeholder: "AAAA..." }, { name: "apiUrl", label: "Posts API URL", type: "text", placeholder: "Paste posts endpoint URL" }] },
  { id: "instagram", name: "Instagram", group: "Social Inputs", description: "Track posts and engagement inputs.", fields: [{ name: "accessToken", label: "Access Token", type: "password", placeholder: "Paste token" }, { name: "apiUrl", label: "Posts API URL", type: "text", placeholder: "Paste posts endpoint URL" }] },
  { id: "facebook", name: "Facebook Page", group: "Social Inputs", description: "Track page posts and engagement.", fields: [{ name: "pageAccessToken", label: "Page Access Token", type: "password", placeholder: "Paste token" }, { name: "apiUrl", label: "Posts API URL", type: "text", placeholder: "Paste posts endpoint URL" }] },
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

const integrationDetailCopy: Record<string, IntegrationDetailCopy> = {
  stripe: {
    accent: "#635bff",
    icon: "S",
    setupTitle: "How to connect Stripe",
    setupSteps: [
      "Create a restricted key in Stripe with read access to charges, customers, invoices, and subscriptions.",
      "Paste the key into the configuration field.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Stripe API keys", href: "https://dashboard.stripe.com/apikeys" }],
    dataRead: ["Payments", "Customers", "Subscriptions", "Refunds"],
    destination: "Finance, Retention, Most Important Metrics",
  },
  whop: {
    accent: "#f45d48",
    icon: "W",
    setupTitle: "How to connect Whop",
    setupSteps: [
      "Create or copy a company API key from Whop.",
      "Add a payments endpoint if your account uses a custom export URL.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Whop", href: "https://whop.com" }],
    dataRead: ["Payments", "Members", "Subscriptions", "Revenue events"],
    destination: "Finance, Retention, Most Important Metrics",
  },
  fanbasis: {
    accent: "#7138e8",
    icon: "F",
    setupTitle: "How to connect Fanbasis",
    setupSteps: [
      "Copy the Fanbasis API key for the account you want to sync.",
      "Paste the payments endpoint used for exports or API reads.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Fanbasis", href: "https://fanbasis.com" }],
    dataRead: ["Payments", "Customers", "Orders", "Revenue events"],
    destination: "Finance, Retention, Most Important Metrics",
  },
  plaid: {
    accent: "#4fd26b",
    icon: "P",
    setupTitle: "How to connect Plaid",
    setupSteps: [
      "Use your Plaid client ID and the matching environment secret.",
      "Add a bank-account access token for the account you want to sync.",
      "Set the environment to sandbox, development, or production.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Plaid dashboard", href: "https://dashboard.plaid.com" }],
    dataRead: ["Bank transactions", "Account names", "Categories", "Balances when available"],
    destination: "Financials, Inputs, Most Important Metrics",
  },
  "csv-banking": {
    accent: "#1f2937",
    icon: "CB",
    setupTitle: "How to import banking CSVs",
    setupSteps: [
      "Export transactions from your bank or accounting tool as a CSV.",
      "Upload the file or paste the CSV rows.",
      "Import the transactions, then refresh metrics.",
    ],
    links: [],
    dataRead: ["Transaction dates", "Descriptions", "Amounts", "Categories when included"],
    destination: "Financials, Inputs, Most Important Metrics",
  },
  quickbooks: {
    accent: "#98a2b3",
    icon: "QB",
    setupTitle: "How to connect QuickBooks",
    setupSteps: [
      "Copy the access token and company ID for the QuickBooks company.",
      "Choose sandbox or production for the environment.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open QuickBooks", href: "https://quickbooks.intuit.com" }],
    dataRead: ["Accounts", "Bank transactions", "Invoices", "Payments"],
    destination: "Financials, Inputs, Most Important Metrics",
  },
  calendly: {
    accent: "#146ef5",
    icon: "C",
    setupTitle: "How to find your Personal Access Token",
    setupSteps: [
      "Log in to Calendly.",
      "Go to Integrations & Apps, then API & Webhooks.",
      "Generate a Personal Access Token.",
      "Copy the token and paste it above.",
      "Save the connection, then refresh data.",
    ],
    links: [
      { label: "Open Calendly settings", href: "https://calendly.com/integrations/api_webhooks" },
      { label: "API documentation", href: "https://developer.calendly.com" },
    ],
    dataRead: ["Scheduled events", "Invitee info", "Event types", "Sales call timing"],
    destination: "Sales, Cost Per Call, Most Important Metrics",
  },
  calcom: {
    accent: "#111827",
    icon: "Ca",
    setupTitle: "How to connect Cal.com",
    setupSteps: [
      "Copy an API key from Cal.com settings.",
      "Add a custom bookings endpoint if your workspace uses one.",
      "Save the connection, then refresh data.",
    ],
    links: [
      { label: "Open Cal.com", href: "https://app.cal.com/settings/developer/api-keys" },
      { label: "API documentation", href: "https://cal.com/docs/api-reference" },
    ],
    dataRead: ["Bookings", "Attendees", "Event types", "Sales call timing"],
    destination: "Sales, Cost Per Call, Most Important Metrics",
  },
  iclosed: {
    accent: "#635bff",
    icon: "iC",
    setupTitle: "How to connect iClosed",
    setupSteps: [
      "Copy the API key for your iClosed workspace.",
      "Paste the calls endpoint used by your account.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open iClosed", href: "https://www.iclosed.io" }],
    dataRead: ["Booked calls", "Shown calls", "Qualified calls", "Sales outcomes"],
    destination: "Sales, Cost Per Call, Most Important Metrics",
  },
  readai: {
    accent: "#7c3aed",
    icon: "R",
    setupTitle: "How to connect Read.ai",
    setupSteps: [
      "Copy the API key from your Read.ai workspace.",
      "Paste the recordings or meetings endpoint.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Read.ai", href: "https://app.read.ai" }],
    dataRead: ["Meeting notes", "Transcripts", "Call summaries", "Recordings"],
    destination: "Sales, Raw Data, Most Important Metrics",
  },
  fathom: {
    accent: "#319795",
    icon: "Fa",
    setupTitle: "How to connect Fathom",
    setupSteps: [
      "Copy the API key from your Fathom account.",
      "Paste the recordings endpoint.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Fathom", href: "https://fathom.video" }],
    dataRead: ["Meeting notes", "Transcripts", "Call summaries", "Recordings"],
    destination: "Sales, Raw Data, Most Important Metrics",
  },
  fireflies: {
    accent: "#ff7816",
    icon: "FF",
    setupTitle: "How to connect Fireflies",
    setupSteps: [
      "Copy the API key from your Fireflies workspace.",
      "Paste the recordings endpoint.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Fireflies", href: "https://app.fireflies.ai" }],
    dataRead: ["Meeting notes", "Transcripts", "Call summaries", "Recordings"],
    destination: "Sales, Raw Data, Most Important Metrics",
  },
  typeform: {
    accent: "#111827",
    icon: "TF",
    setupTitle: "How to connect Typeform",
    setupSteps: [
      "Create or copy a Typeform personal token.",
      "Optionally add one form ID to sync only that form.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Typeform tokens", href: "https://admin.typeform.com/account#/section/tokens" }],
    dataRead: ["Form submissions", "Lead names", "Lead emails", "Submitted answers"],
    destination: "Inputs, Sales, Most Important Metrics",
  },
  heyflow: {
    accent: "#3867e8",
    icon: "HF",
    setupTitle: "How to connect Heyflow",
    setupSteps: [
      "Copy the API key for your Heyflow workspace.",
      "Paste the submissions endpoint.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Heyflow", href: "https://app.heyflow.com" }],
    dataRead: ["Form submissions", "Lead names", "Lead emails", "Submitted answers"],
    destination: "Inputs, Sales, Most Important Metrics",
  },
  "paid-ads": {
    accent: "#2563eb",
    icon: "AD",
    setupTitle: "How to connect paid ads",
    setupSteps: [
      "Paste the account URL, report URL, or export endpoint for the ad source.",
      "Make sure the report includes spend, leads, and dates.",
      "Save the connection, then refresh data.",
    ],
    links: [],
    dataRead: ["Spend", "Leads", "Campaign names", "Performance rows"],
    destination: "Inputs, Marketing, Most Important Metrics",
  },
  "cold-email": {
    accent: "#0ea5e9",
    icon: "CE",
    setupTitle: "How to connect cold email",
    setupSteps: [
      "Paste the account URL, feed URL, or export endpoint.",
      "Make sure the source includes leads, replies, and dates when available.",
      "Save the connection, then refresh data.",
    ],
    links: [],
    dataRead: ["Leads", "Replies", "Campaign rows", "Performance rows"],
    destination: "Inputs, Marketing, Most Important Metrics",
  },
  newsletter: {
    accent: "#16a34a",
    icon: "NL",
    setupTitle: "How to connect newsletter",
    setupSteps: [
      "Paste the account URL, RSS URL, or export endpoint.",
      "Make sure the source includes posts, leads, and engagement when available.",
      "Save the connection, then refresh data.",
    ],
    links: [],
    dataRead: ["Subscribers", "Posts", "Engagement", "Lead rows"],
    destination: "Inputs, Marketing, Most Important Metrics",
  },
  linkedin: {
    accent: "#0a66c2",
    icon: "in",
    setupTitle: "How to connect LinkedIn",
    setupSteps: [
      "Paste the access token for the LinkedIn account or page.",
      "Add a posts endpoint when using a custom data source.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open LinkedIn", href: "https://www.linkedin.com" }],
    dataRead: ["Posts", "Views", "Engagement", "Audience responses"],
    destination: "Inputs, Marketing, Most Important Metrics",
  },
  twitter: {
    accent: "#111827",
    icon: "X",
    setupTitle: "How to connect X",
    setupSteps: [
      "Paste the bearer token for the X account.",
      "Add a posts endpoint when using a custom data source.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open X developer portal", href: "https://developer.x.com" }],
    dataRead: ["Posts", "Views", "Engagement", "Audience responses"],
    destination: "Inputs, Marketing, Most Important Metrics",
  },
  instagram: {
    accent: "#e4405f",
    icon: "IG",
    setupTitle: "How to connect Instagram",
    setupSteps: [
      "Paste the access token for the Instagram account.",
      "Add a posts endpoint when using a custom data source.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Meta for Developers", href: "https://developers.facebook.com" }],
    dataRead: ["Posts", "Reels", "Views", "Engagement"],
    destination: "Inputs, Marketing, Most Important Metrics",
  },
  facebook: {
    accent: "#1877f2",
    icon: "fb",
    setupTitle: "How to connect Facebook",
    setupSteps: [
      "Paste the page access token for the Facebook Page.",
      "Add a posts endpoint when using a custom data source.",
      "Save the connection, then refresh data.",
    ],
    links: [{ label: "Open Meta for Developers", href: "https://developers.facebook.com" }],
    dataRead: ["Page posts", "Views", "Engagement", "Audience responses"],
    destination: "Inputs, Marketing, Most Important Metrics",
  },
  slack: {
    accent: "#4a154b",
    icon: "S",
    setupTitle: "How to connect Slack",
    setupSteps: [
      "Start the Slack connection flow.",
      "Approve the workspace and channel access.",
      "Return to HyperOptimal Metrics and test commands from Slack.",
    ],
    links: [],
    dataRead: ["Commands", "Channel messages sent to the app", "Agent requests", "Responses"],
    destination: "AI Agent, Metrics, Constraints, Forecasting",
  },
  telegram: {
    accent: "#229ed9",
    icon: "T",
    setupTitle: "How to connect Telegram",
    setupSteps: [
      "Generate a link code.",
      "Send the code to the Telegram bot using the link command.",
      "Return to HyperOptimal Metrics and test commands from Telegram.",
    ],
    links: [],
    dataRead: ["Commands", "Chat messages sent to the app", "Agent requests", "Responses"],
    destination: "AI Agent, Metrics, Constraints, Forecasting",
  },
};

export function getIntegrationDetailCopy(definition: IntegrationDefinition) {
  return integrationDetailCopy[definition.id] ?? {
    accent: "#2563eb",
    icon: definition.name.slice(0, 2).toUpperCase(),
    setupTitle: `How to connect ${definition.name}`,
    setupSteps: [
      `Add the connection details for ${definition.name}.`,
      "Save the connection, then refresh data.",
    ],
    links: [],
    dataRead: ["Source records", "Timestamps", "Account details when available"],
    destination: definition.group,
  };
}
