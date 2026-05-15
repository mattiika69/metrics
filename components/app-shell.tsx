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
  | "account"
  | "admin";

type AppShellProps = {
  active: ActiveRoute;
  tenantName?: string | null;
  children: React.ReactNode;
};

const primaryItems: SidebarItem[] = [
  { id: "dashboard", label: "CEO Dashboard", href: "/dashboard" },
  { id: "marketing", label: "Marketing", href: "/marketing" },
  { id: "sales", label: "Sales", href: "/sales" },
  { id: "retention", label: "Retention", href: "/retention" },
  { id: "finance", label: "Finance", href: "/finance" },
  { id: "constraints", label: "Constraints", href: "/constraints" },
  { id: "forecasting", label: "Forecasting", href: "/forecasting" },
  { id: "settings", label: "Settings", href: "/settings/team" },
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
        <div className="side-brand-row">
          <Link href="/dashboard" className="side-brand">
            <span className="brand-mark" aria-hidden="true">
              H
            </span>
            <span>HyperOptimal Metrics</span>
          </Link>
        </div>

        <nav className="sidebar-sections" aria-label="Primary navigation">
          <SidebarNav active={active === "integrations" ? "settings" : active} items={sidebarItems} />
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
