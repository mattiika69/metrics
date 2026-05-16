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
  | "metrics-quality-assurance"
  | "settings"
  | "settings-account"
  | "settings-team"
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
  { id: "metrics-reverse-engineering", label: "Reverse Engineering", href: "/forecasting", section: "metrics" },
  { id: "metrics-financial", label: "Financial", href: "/finance", section: "metrics" },
  { id: "metrics-churn-ltv", label: "Churn & LTV", href: "/retention", section: "metrics" },
  { id: "metrics-sales", label: "Sales", href: "/sales", section: "metrics" },
  { id: "metrics-cost-per-call", label: "Cost Per Call", href: "/metrics/cost-per-call", section: "metrics" },
  { id: "metrics-inputs", label: "Inputs", href: "/marketing", section: "metrics" },
  { id: "constraints", label: "Constraints", href: "/constraints", section: "metrics" },
  { id: "settings-account", label: "Account", href: "/settings/account", section: "settings" },
  { id: "settings-team", label: "Team", href: "/settings/team", section: "settings" },
  { id: "settings-billing", label: "Billing", href: "/settings/billing", section: "settings" },
  { id: "settings-integrations", label: "Integrations", href: "/integrations", section: "settings" },
  { id: "settings-scheduling", label: "Scheduling", href: "/settings/scheduling", section: "settings" },
  { id: "settings-slack", label: "Slack", href: "/settings/slack", section: "settings" },
  { id: "settings-telegram", label: "Telegram", href: "/settings/telegram", section: "settings" },
];

async function getOrderedSidebarItems() {
  const order = await loadSidebarOrder(primaryItems.map((item) => item.id));
  const itemById = new Map(primaryItems.map((item) => [item.id, item]));
  return order
    .map((itemId) => itemById.get(itemId as ActiveRoute))
    .filter((item): item is SidebarItem => Boolean(item));
}

export async function AppShell({ active, tenantName, children }: AppShellProps) {
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
          <div className="org-select" aria-label="Current organization">
            <span>Org:</span>
            <strong>{tenantName || "Hyper Optimal Team"}</strong>
            <span className="org-chevron" aria-hidden="true">⌄</span>
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
      </section>
    </main>
  );
}
