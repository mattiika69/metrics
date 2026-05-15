import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { isAuthBypassEnabled } from "@/lib/auth/bypass";

type AppShellProps = {
  active: "dashboard" | "metrics" | "integrations" | "constraints" | "settings" | "account" | "admin";
  tenantName?: string | null;
  children: React.ReactNode;
};

const navItems = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "metrics", label: "Metrics", href: "/metrics" },
  { id: "integrations", label: "Integrations", href: "/integrations" },
  { id: "constraints", label: "Constraints", href: "/constraints" },
  { id: "settings", label: "Settings", href: "/settings" },
  { id: "account", label: "Account", href: "/account" },
] as const;

export function AppShell({ active, tenantName, children }: AppShellProps) {
  const authBypassEnabled = isAuthBypassEnabled();

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <Link href="/dashboard" className="brand">
          HyperOptimal Metrics
        </Link>
        <div className="nav-links" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={active === item.id ? "nav-link active" : "nav-link"}
            >
              {item.label}
            </Link>
          ))}
          {authBypassEnabled ? null : (
            <form action={signOutAction}>
              <button type="submit" className="link-button">
                Sign out
              </button>
            </form>
          )}
        </div>
      </nav>
      {tenantName ? <p className="workspace-label">{tenantName}</p> : null}
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
