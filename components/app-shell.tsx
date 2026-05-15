import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";

type AppShellProps = {
  active: "dashboard" | "metrics" | "integrations" | "constraints" | "settings" | "account" | "admin";
  tenantName?: string | null;
  children: React.ReactNode;
};

const navItems = [
  { id: "dashboard", label: "Today", href: "/dashboard", icon: "✓" },
  { id: "metrics", label: "Metrics", href: "/metrics", icon: "▦" },
  { id: "integrations", label: "Integrations", href: "/integrations", icon: "⌁" },
  { id: "constraints", label: "Constraints", href: "/constraints", icon: "◎" },
  { id: "settings", label: "Settings", href: "/settings", icon: "⚙" },
  { id: "account", label: "Account", href: "/account", icon: "◷" },
] as const;

export function AppShell({ active, tenantName, children }: AppShellProps) {
  const authBypassEnabled = isAuthBypassEnabled();

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <Link href="/dashboard" className="brand">
          HyperOptimal Metrics
        </Link>
        <div className="nav-links-wrap">
          <div className="nav-links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={active === item.id ? "nav-link active" : "nav-link"}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="account-cluster">
            {tenantName ? (
              <span className="account-pill">
                <span className="avatar subtle" aria-hidden="true">
                  {tenantName.slice(0, 1).toUpperCase()}
                </span>
                {tenantName}
              </span>
            ) : null}
            <Link href="/account" className="avatar hot" aria-label="Account">
              M
            </Link>
          </div>
          {authBypassEnabled ? null : (
            <form action={signOutAction}>
              <button type="submit" className="link-button">
                Sign out
              </button>
            </form>
          )}
        </div>
      </nav>
      {children}
    </main>
  );
}

export function MetricsSubnav({ active }: { active: string }) {
  const items = [
    { id: "most-important", label: "Most Important", href: "/metrics/most-important" },
    { id: "raw-data", label: "Raw Data", href: "/metrics/raw-data" },
    { id: "benchmarking", label: "Benchmarking", href: "/metrics/benchmarking" },
    { id: "principles", label: "Principles", href: "/metrics/principles" },
    { id: "quality-assurance", label: "Quality Assurance", href: "/metrics/quality-assurance" },
  ];

  return (
    <nav className="sub-nav" aria-label="Metrics navigation">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={active === item.id ? "sub-nav-link active" : "sub-nav-link"}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
