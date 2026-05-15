import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";

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

type NavItem = {
  id: ActiveRoute;
  label: string;
  href: string;
};

const primaryItems = [
  { id: "dashboard", label: "CEO Dashboard", href: "/dashboard" },
  { id: "marketing", label: "Marketing", href: "/marketing" },
  { id: "sales", label: "Sales", href: "/sales" },
  { id: "retention", label: "Retention", href: "/retention" },
  { id: "finance", label: "Finance", href: "/finance" },
  { id: "constraints", label: "Constraints", href: "/constraints" },
  { id: "forecasting", label: "Forecasting", href: "/forecasting" },
  { id: "integrations", label: "Integrations", href: "/integrations" },
  { id: "settings", label: "Settings", href: "/settings/team" },
] as const;

function SidebarLink({
  item,
  active,
}: {
  item: NavItem;
  active: ActiveRoute;
}) {
  return (
    <Link
      href={item.href}
      prefetch
      className={active === item.id ? "sidebar-parent-link active" : "sidebar-parent-link"}
    >
      <span className="sidebar-parent-chevron" aria-hidden="true">›</span>
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({ active, children }: AppShellProps) {
  const authBypassEnabled = isAuthBypassEnabled();

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
          <span className="collapse-dot" aria-hidden="true">
            ‹
          </span>
        </div>

        <nav className="sidebar-sections" aria-label="Primary navigation">
          <div className="sidebar-flat-nav">
            {primaryItems.map((item) => (
              <SidebarLink key={item.id} item={item} active={active} />
            ))}
          </div>
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
