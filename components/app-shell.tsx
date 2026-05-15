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
] as const;

const settingsItems = [
  { id: "settings", label: "Team", href: "/settings/team" },
] as const;

function SectionChevron() {
  return (
    <svg className="sidebar-label-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SidebarSection({
  title,
  items,
  active,
}: {
  title: string;
  items: readonly NavItem[];
  active: ActiveRoute;
}) {
  return (
    <div className="sidebar-group">
      <div className="sidebar-label-row">
        <button type="button" className="sidebar-label-button" aria-expanded="true">
          <SectionChevron />
          <span>{title}</span>
        </button>
      </div>
      <div className="sidebar-subnav">
        {items.map((item) => (
          <div className="sidebar-menu-row" key={item.id}>
            <Link
              href={item.href}
              prefetch
              className={active === item.id ? "sidebar-sub-link active" : "sidebar-sub-link"}
            >
              {item.label}
            </Link>
            <span className="sidebar-drag-handle" title="Drag to reorder" aria-hidden="true">
              ⋮⋮
            </span>
          </div>
        ))}
      </div>
    </div>
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
          <SidebarSection title="HyperOptimal Metrics" items={primaryItems} active={active} />

          <div className="sidebar-divider" />
          <SidebarSection title="Settings" items={settingsItems} active={active} />
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
