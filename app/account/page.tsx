import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireTenant } from "@/lib/auth/session";

export default async function AccountPage() {
  const { user, tenant, membership } = await requireTenant();

  return (
    <AppShell active="account" tenantName={tenant.name}>
      <section className="page-header">
        <p className="eyebrow">Account</p>
        <h1>Profile and access</h1>
        <p className="lede">Your identity and workspace membership.</p>
      </section>
      <section className="settings-list">
        <div>
          <span>Email</span>
          <strong>{user.email}</strong>
        </div>
        <div>
          <span>Workspace</span>
          <strong>{tenant.name}</strong>
        </div>
        <div>
          <span>Role</span>
          <strong>{membership.role}</strong>
        </div>
        <div>
          <span>Password</span>
          <Link href="/forgot-password">Reset password</Link>
        </div>
      </section>
    </AppShell>
  );
}
