import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <article className="legal-doc">
        <Link href="/" className="brand">
          HyperOptimal Metrics
        </Link>
        <h1>Terms of Service</h1>
        <p>Effective date: May 15, 2026</p>
        <h2>Use of the service</h2>
        <p>
          HyperOptimal Metrics is a workspace-based application for metrics,
          reporting, integrations, and operational workflows. Users must only
          access workspaces they are authorized to use.
        </p>
        <h2>Accounts and administrators</h2>
        <p>
          Workspace owners and administrators are responsible for user access,
          billing configuration, connected integrations, and compliance with
          applicable laws.
        </p>
        <h2>Messaging and communications</h2>
        <p>
          Email, SMS, Slack, and Telegram features must be used lawfully and with
          appropriate consent. Users are responsible for honoring opt-outs and
          communication preferences.
        </p>
        <h2>Billing</h2>
        <p>
          Paid features may be governed by subscription status at the workspace
          level. Subscription changes may affect workspace access.
        </p>
        <h2>Acceptable use</h2>
        <p>
          Do not use the service to abuse third-party systems, send unlawful
          messages, bypass access controls, or process data without permission.
        </p>
      </article>
    </main>
  );
}
