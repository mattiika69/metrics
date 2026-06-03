import { AppShell } from "@/components/app-shell";
import { SettingsHeader, SettingsTabs } from "@/components/settings/settings-tabs";
import { signOutAction } from "@/lib/auth/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LogoutSettingsPage() {
  const { tenant } = await requireTenant();

  return (
    <AppShell active="settings-logout" tenantName={tenant.name}>
      <SettingsHeader title="Log out" />
      <SettingsTabs active="logout" />
      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Session</p>
              <h2>Log out</h2>
            </div>
          </div>
          <p className="muted">Sign out when you are done working on this device.</p>
          <form action={signOutAction} className="card-action">
            <button type="submit">Log out</button>
          </form>
        </article>
      </section>
    </AppShell>
  );
}
