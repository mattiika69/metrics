import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";

type AppShellProps = {
  active:
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
    | "metrics-quality-assurance"
    | "settings"
    | "account"
    | "admin";
  tenantName?: string | null;
  children: React.ReactNode;
};

const topSections = [
  { id: "dashboard", label: "Today", href: "/dashboard" },
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
  { id: "metrics-quality-assurance", label: "Quality Assurance", href: "/metrics/quality-assurance" },
] as const;

const settingsItems = [
  { id: "settings", label: "Settings", href: "/settings/team" },
  { id: "admin", label: "Admin", href: "/admin" },
  { id: "account", label: "Account", href: "/account" },
] as const;

export function AppShell({ active, tenantName, children }: AppShellProps) {
  const authBypassEnabled = isAuthBypassEnabled();
  const metricsActive = active.startsWith("metrics-");
  const settingsActive = active === "settings" || active === "admin" || active === "account";

  return (
    <main className="app-shell">
      <aside className="side-nav">
        <div className="side-brand-row">
          <Link href="/dashboard" className="side-brand">
            <span className="brand-mark" aria-hidden="true">
              H
            </span>
            <span>HyperOptimal</span>
          </Link>
          <span className="collapse-dot" aria-hidden="true">
            ‹
          </span>
        </div>
        <div className="org-select">
          <span>Org:</span>
          <strong>{tenantName ?? "Matthew"}</strong>
        </div>

        <nav className="sidebar-sections" aria-label="Primary navigation">
          <div className="sidebar-divider" />
          <p className="sidebar-label">Most Viewed</p>
          {topSections.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={active === item.id ? "sidebar-link active" : "sidebar-link"}
            >
              <span className="chevron" aria-hidden="true">
                ›
              </span>
              {item.label}
            </Link>
          ))}

          <div className="sidebar-divider" />
          <p className="sidebar-label">Team</p>
          <Link href="/settings/team" className={active === "settings" ? "sidebar-link active" : "sidebar-link"}>
            <span className="chevron" aria-hidden="true">
              ›
            </span>
            Team
          </Link>

          <div className="sidebar-group">
            <p className={metricsActive ? "sidebar-label expanded" : "sidebar-label"}>Metrics</p>
            <div className="sidebar-subnav">
              {metricItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={active === item.id ? "sidebar-sub-link active" : "sidebar-sub-link"}
                >
                  {item.label}
                  <span aria-hidden="true">⋮</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="sidebar-divider" />
          <div className="sidebar-group">
            <p className={settingsActive ? "sidebar-label expanded" : "sidebar-label"}>Settings</p>
            <div className="sidebar-subnav">
              {settingsItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={active === item.id ? "sidebar-sub-link active" : "sidebar-sub-link"}
                >
                  {item.label}
                  <span aria-hidden="true">⋮</span>
                </Link>
              ))}
              {authBypassEnabled ? null : (
                <form action={signOutAction}>
                  <button type="submit" className="sidebar-logout">
                    Log Out
                  </button>
                </form>
              )}
            </div>
          </div>
        </nav>
      </aside>
      <section className="app-main">
        <div className="app-content">{children}</div>
      </section>
    </main>
  );
}
