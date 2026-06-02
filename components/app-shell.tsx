import { AppSidebar } from "@/components/app-sidebar";
import type { SidebarItem } from "@/components/sidebar-nav";
import { signOutAction } from "@/lib/auth/actions";
import { loadSidebarOrder } from "@/lib/navigation/sidebar-actions";

export type ActiveRoute =
  | "dashboard"
  | "marketing"
  | "sales"
  | "retention"
  | "finance"
  | "forecasting"
  | "integrations"
  | "constraints"
  | "metrics-most-important"
  | "metrics-reverse-engineering"
  | "metrics-financial"
  | "metrics-churn-ltv"
  | "metrics-sales"
  | "metrics-cost-per-call"
  | "metrics-inputs"
  | "metrics-raw-data"
  | "metrics-benchmarking"
  | "metrics-principles"
  | "settings"
  | "settings-account"
  | "settings-team"
  | "settings-billing"
  | "settings-integrations"
  | "settings-scheduling"
  | "settings-slack"
  | "settings-telegram"
  | "help"
  | "account"
  | "admin";

type AppShellProps = {
  active: ActiveRoute;
  tenantName?: string | null;
  children: React.ReactNode;
};

const primaryItems: SidebarItem[] = [
  {
    id: "dashboard",
    label: "Metrics",
    href: "/dashboard",
    section: "metrics",
    children: [
      { id: "metrics-ceo-dashboard", label: "CEO Dashboard", href: "/dashboard", activeRoutes: ["dashboard"] },
      { id: "metrics-most-important-link", label: "Most Important Metrics", href: "/metrics/most-important", activeRoutes: ["metrics-most-important"] },
      { id: "metrics-benchmarks-link", label: "Benchmarks", href: "/benchmarks", activeRoutes: ["metrics-benchmarking"] },
      { id: "metrics-constraints-link", label: "Constraints", href: "/constraints", activeRoutes: ["constraints"] },
      { id: "metrics-reverse-link", label: "Reverse Engineering", href: "/metrics/reverse-engineering", activeRoutes: ["metrics-reverse-engineering"] },
      { id: "metrics-forecast-link", label: "Forecasting", href: "/forecasting", activeRoutes: ["forecasting"] },
      { id: "metrics-raw-data-link", label: "Raw Data", href: "/metrics/raw-data", activeRoutes: ["metrics-raw-data"] },
      { id: "metrics-principles-link", label: "Principles", href: "/metrics/principles", activeRoutes: ["metrics-principles"] },
    ],
  },
  {
    id: "metrics-financial",
    label: "Financials",
    href: "/finance",
    section: "metrics",
    children: [
      { id: "financial-overview", label: "Overview", href: "/finance" },
      { id: "financial-transactions-in", label: "Transactions In", href: "/finance/transactions-in" },
      { id: "financial-transactions-out", label: "Transactions Out", href: "/finance/transactions-out" },
      { id: "financial-categories", label: "Categories", href: "/finance/categories" },
      { id: "financial-cost-per-category", label: "Cost Per Category", href: "/finance/cost-per-category" },
    ],
  },
  {
    id: "metrics-churn-ltv",
    label: "Retention",
    href: "/retention",
    section: "metrics",
    children: [
      { id: "retention-overview", label: "Overview", href: "/retention" },
      { id: "retention-client-data", label: "Client Data", href: "/retention/client-data" },
      { id: "retention-client-payments", label: "Client Payments", href: "/retention/client-payments" },
    ],
  },
  {
    id: "metrics-sales",
    label: "Sales",
    href: "/sales",
    section: "metrics",
    children: [
      { id: "sales-overview", label: "Overview", href: "/sales" },
      { id: "sales-calls", label: "Calls", href: "/sales/calls" },
    ],
  },
  {
    id: "metrics-inputs",
    label: "Inputs",
    href: "/inputs",
    section: "metrics",
    children: [
      { id: "inputs-overview", label: "Overview", href: "/inputs" },
      { id: "inputs-cost-per-call", label: "Cost Per Call", href: "/inputs?tab=cost-per-call" },
      { id: "inputs-paid-ads", label: "Paid Ads", href: "/inputs?tab=paid-ads" },
      { id: "inputs-cold-email", label: "Cold Email", href: "/inputs?tab=cold-email" },
      { id: "inputs-newsletter", label: "Newsletter", href: "/inputs?tab=newsletter" },
      { id: "inputs-accounts", label: "Accounts", href: "/inputs?tab=accounts" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings/account",
    section: "settings",
    children: [
      { id: "settings-account", label: "Account", href: "/settings/account", activeRoutes: ["settings-account"] },
      { id: "settings-team", label: "Team", href: "/settings/team", activeRoutes: ["settings-team"] },
      { id: "settings-billing", label: "Billing", href: "/settings/billing", activeRoutes: ["settings-billing"] },
      { id: "settings-integrations", label: "Integrations", href: "/settings/integrations", activeRoutes: ["settings-integrations"] },
      { id: "settings-scheduling", label: "Scheduling", href: "/settings/scheduling", activeRoutes: ["settings-scheduling"] },
      { id: "settings-slack", label: "Slack", href: "/settings/slack", activeRoutes: ["settings-slack"] },
      { id: "settings-telegram", label: "Telegram", href: "/settings/telegram", activeRoutes: ["settings-telegram"] },
    ],
  },
  {
    id: "account",
    label: "Account",
    href: "/account",
    section: "settings",
  },
  {
    id: "help",
    label: "Help",
    href: "/help",
    section: "settings",
  },
];

async function getOrderedSidebarItems() {
  const order = await loadSidebarOrder(primaryItems.map((item) => item.id));
  const itemById = new Map(primaryItems.map((item) => [item.id, item]));
  return order
    .map((itemId) => itemById.get(itemId as ActiveRoute))
    .filter((item): item is SidebarItem => Boolean(item));
}

export async function AppShell({ active, children }: AppShellProps) {
  const sidebarItems = await getOrderedSidebarItems();

  return (
    <main className="app-shell">
      <AppSidebar active={active} items={sidebarItems} logoutAction={signOutAction} />
      <section className="app-main">
        <div className="app-content">{children}</div>
      </section>
    </main>
  );
}
