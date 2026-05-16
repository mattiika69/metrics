import Link from "next/link";
import { SidebarNav, type SidebarItem } from "@/components/sidebar-nav";
import { signOutAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";
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
  | "ai-context"
  | "learnings"
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
  | "settings-learning"
  | "settings-billing"
  | "settings-integrations"
  | "settings-scheduling"
  | "settings-slack"
  | "settings-telegram"
  | "account"
  | "admin";

type AppShellProps = {
  active: ActiveRoute;
  tenantName?: string | null;
  children: React.ReactNode;
};

const primaryItems: SidebarItem[] = [
  { id: "metrics-most-important", label: "Most Important Metrics", href: "/dashboard", section: "metrics" },
  { id: "metrics-reverse-engineering", label: "Reverse Engineering", href: "/metrics/reverse-engineering", section: "metrics" },
  { id: "forecasting", label: "Forecasting", href: "/forecasting", section: "metrics" },
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
  { id: "metrics-benchmarking", label: "Benchmarks", href: "/benchmarks", section: "metrics" },
  { id: "constraints", label: "Constraints", href: "/constraints", section: "metrics" },
  { id: "ai-context", label: "AI Context Document", href: "/ai-context-doc", section: "metrics" },
  { id: "learnings", label: "Learnings", href: "/learnings", section: "metrics" },
  { id: "settings", label: "Settings", href: "/settings/account", section: "settings" },
];

const appLinks = [
  { label: "Management", href: "https://management.hyperoptimal.com" },
  { label: "Follow Up", href: "https://followup.hyperoptimal.com" },
  { label: "Ads", href: "https://ads.hyperoptimal.com" },
  { label: "Planning", href: "https://planning.hyperoptimal.com" },
  { label: "Metrics", href: "https://metrics.hyperoptimal.com" },
  { label: "Funnel", href: "https://funnel.hyperoptimal.com" },
  { label: "Content", href: "https://content.hyperoptimal.com" },
];

async function getOrderedSidebarItems() {
  const order = await loadSidebarOrder(primaryItems.map((item) => item.id));
  const itemById = new Map(primaryItems.map((item) => [item.id, item]));
  return order
    .map((itemId) => itemById.get(itemId as ActiveRoute))
    .filter((item): item is SidebarItem => Boolean(item));
}

export async function AppShell({ active, children }: AppShellProps) {
  const authBypassEnabled = isAuthBypassEnabled();
  const sidebarItems = await getOrderedSidebarItems();

  return (
    <main className="app-shell">
      <aside className="side-nav">
        <div className="side-shell-header">
          <div className="side-brand-row">
            <Link href="/dashboard" className="side-brand">
              <span className="brand-mark" aria-hidden="true">
                H
              </span>
              <span>HyperOptimal</span>
            </Link>
            <span className="collapse-dot" aria-hidden="true">‹</span>
          </div>
        </div>

        <nav className="sidebar-sections" aria-label="Primary navigation">
          <SidebarNav active={active} items={sidebarItems} />
          {authBypassEnabled ? null : (
            <form action={signOutAction}>
              <button type="submit" className="sidebar-logout">
                Log Out
              </button>
            </form>
          )}
        </nav>
      </aside>
      <section className="app-main">
        <div className="app-content">{children}</div>
        <footer className="app-footer">
          <div>
            <strong>HyperOptimal Metrics</strong>
            <span>© {new Date().getFullYear()} HyperOptimal. All rights reserved.</span>
          </div>
          <nav aria-label="Footer navigation">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            {appLinks.map((link) => (
              <a href={link.href} key={link.label}>
                {link.label}
              </a>
            ))}
          </nav>
        </footer>
      </section>
    </main>
  );
}
