import { AppShell } from "@/components/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { signOutAction } from "@/lib/auth/actions";
import { requireTenant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const { supabase, user, tenant, membership } = await requireTenant();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("email, full_name, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AppShell active="settings" tenantName={tenant.name}>
      <section className="page-header compact">
        <p className="eyebrow">{tenant.name}</p>
        <h1>Settings</h1>
        <p className="lede">Manage your account and workspace access.</p>
      </section>
      <SettingsTabs active="account" />
      <section className="settings-layout">
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Account</p>
              <h2>Profile</h2>
            </div>
            <span className="pill">{membership.role}</span>
          </div>
          <div className="settings-list">
            <div>
              <span>Name</span>
              <strong>{profile?.full_name ?? "Not set"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profile?.email ?? user.email ?? "Not available"}</strong>
            </div>
            <div>
              <span>Workspace</span>
              <strong>{tenant.name}</strong>
            </div>
          </div>
        </article>
        <article className="settings-panel">
          <div className="panel-heading">
            <div>
              <p className="step-label">Session</p>
              <h2>Access</h2>
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
