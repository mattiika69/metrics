import Link from "next/link";
import type { ReactNode } from "react";

type AdminShellProps = {
  active: "overview" | "users" | "orgs" | "billing" | "webhook-events" | "audit-logs";
  title: string;
  subtitle?: string;
  children: ReactNode;
};

const adminLinks = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "users", label: "Users", href: "/admin/users" },
  { id: "orgs", label: "Organizations", href: "/admin/orgs" },
  { id: "billing", label: "Billing", href: "/admin/billing" },
  { id: "webhook-events", label: "Webhook Events", href: "/admin/webhook-events" },
  { id: "audit-logs", label: "Audit Logs", href: "/admin/audit-logs" },
] as const;

export function AdminShell({ active, title, subtitle, children }: AdminShellProps) {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>HyperOptimal Admin</span>
        </Link>
        <nav aria-label="Admin navigation">
          {adminLinks.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={item.id === active ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/dashboard" className="admin-return-link">
          Back to app
        </Link>
      </aside>
      <section className="admin-main">
        <header className="admin-page-header">
          <p>Admin</p>
          <h1>{title}</h1>
          {subtitle ? <span>{subtitle}</span> : null}
        </header>
        {children}
      </section>
    </main>
  );
}

export function AdminNotices({
  notices,
}: {
  notices: { label: string; message: string }[];
}) {
  if (!notices.length) return null;

  return (
    <section className="admin-notices" aria-label="Admin data notices">
      {notices.map((notice) => (
        <article key={`${notice.label}-${notice.message}`}>
          <strong>{notice.label}</strong>
          <span>{notice.message}</span>
        </article>
      ))}
    </section>
  );
}

export function EmptyAdminState({ children }: { children: ReactNode }) {
  return <div className="admin-empty-state">{children}</div>;
}
