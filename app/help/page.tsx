import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const { tenant } = await requireTenant();

  return (
    <AppShell active="help" tenantName={tenant.name}>
      <section className="scaling-page">
        <header className="scaling-header">
          <div>
            <h1>Help</h1>
            <p>MEMBER SINCE MARCH 2026</p>
          </div>
        </header>
        <div className="settings-layout single-column">
          <article className="settings-panel full-span">
            <div className="panel-heading">
              <div>
                <p className="step-label">Support</p>
                <h2>Get help</h2>
              </div>
            </div>
            <div className="settings-list">
              <div>
                <span>Email</span>
                <strong>matt@1000xleads.com</strong>
              </div>
              <div>
                <span>Workspace</span>
                <strong>{tenant.name}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
