import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";

type ActiveRoute =
  | "dashboard"
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
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "ai-context", label: "AI Context Doc", href: "/ai-context-doc" },
  { id: "integrations", label: "Integrations", href: "/integrations" },
  { id: "constraints", label: "Constraints", href: "/constraints" },
] as const;

const metricItems = [
  { id: "metrics-most-important", label: "Most Important Metrics", href: "/metrics/most-important" },
  { id: "metrics-reverse-engineering", label: "Reverse Engineering", href: "/metrics/reverse-engineering" },
  { id: "metrics-financial", label: "Financial", href: "/metrics/financial" },
  { id: "metrics-churn-ltv", label: "Churn & LTV", href: "/metrics/churn-ltv" },
  { id: "metrics-sales", label: "Sales", href: "/metrics/sales" },
  { id: "metrics-cost-per-call", label: "Cost Per Call", href: "/metrics/cost-per-call" },
  { id: "metrics-inputs", label: "Inputs", href: "/metrics/inputs" },
  { id: "metrics-raw-data", label: "Raw Data", href: "/metrics/raw-data" },
  { id: "metrics-benchmarking", label: "Benchmarking", href: "/metrics/benchmarking" },
  { id: "metrics-principles", label: "Principles", href: "/metrics/principles" },
  { id: "metrics-quality-assurance", label: "Quality Assurance", href: "/metrics/quality-assurance" },
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
          <SidebarSection title="App" items={primaryItems} active={active} />

          <div className="sidebar-divider" />
          <SidebarSection title="Metrics" items={metricItems} active={active} />

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
