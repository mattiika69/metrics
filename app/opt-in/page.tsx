import { captureOptInLeadAction } from "./actions";

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

export default async function OptInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = getParam(params, "error");

  return (
    <main className="opt-in-shell">
      <section className="opt-in-card">
        <div className="opt-in-copy">
          <p className="eyebrow">HyperOptimal Metrics</p>
          <h1>Find the three metrics most likely to limit growth this week.</h1>
          <p className="lede">
            Get a concise operating checklist for turning scattered company data
            into a single metric source of truth.
          </p>
          <div className="opt-in-section">
            <h2>Built for operators who need signal now</h2>
            <p>
              Use it before connecting Stripe, banking, scheduling, and sales
              tools so your first dashboard starts with the right decisions.
            </p>
          </div>
          <ul className="opt-in-bullets">
            <li>Choose the metrics that belong on the CEO dashboard.</li>
            <li>Map each metric to the integration that should feed it.</li>
            <li>Identify the benchmark gaps that become constraints.</li>
          </ul>
          <p className="opt-in-trust">
            Designed for founder-led teams building a repeatable weekly
            operating rhythm.
          </p>
        </div>
        <form action={captureOptInLeadAction} className="opt-in-form">
          <div>
            <h2>Get the checklist</h2>
            <p>We will send the next step to your inbox.</p>
          </div>
          {error ? <p className="notice error">{error}</p> : null}
          <label className="auth-field">
            First Name
            <input name="firstName" autoComplete="given-name" placeholder="First name" />
          </label>
          <label className="auth-field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <button type="submit">Send me the checklist</button>
          <p className="opt-in-small">
            No extra paths. Submit once and we will show the next step.
          </p>
        </form>
      </section>
    </main>
  );
}
