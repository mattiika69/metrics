import { createTenantAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  await requireUser();
  const params = await searchParams;
  const error = getParam(params, "error");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Workspace setup</p>
        <h1>Create your workspace</h1>
        <p className="lede">
          Workspaces are tenant boundaries for data, billing, integrations, and
          admin access.
        </p>
        {error ? <p className="notice error">{error}</p> : null}
        <form action={createTenantAction} className="form-stack">
          <label>
            Workspace name
            <input
              name="name"
              type="text"
              placeholder="Acme Growth"
              autoComplete="organization"
              required
            />
          </label>
          <button type="submit">Create workspace</button>
        </form>
      </section>
    </main>
  );
}
