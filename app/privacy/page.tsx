import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <article className="legal-doc">
        <Link href="/" className="brand">
          HyperOptimal Metrics
        </Link>
        <h1>Privacy Policy</h1>
        <p>Effective date: May 15, 2026</p>
        <h2>Data we process</h2>
        <p>
          HyperOptimal Metrics processes account information, workspace data,
          analytics data, integration events, messages, email delivery records,
          SMS delivery records, and billing state needed to operate the service.
        </p>
        <h2>Workspace boundaries</h2>
        <p>
          Customer workspaces are separated from each other. Application data is
          protected by access controls designed to limit access to authorized
          workspace members.
        </p>
        <h2>Service providers</h2>
        <p>
          The service may use trusted providers to host, secure, bill, message,
          and operate the product.
        </p>
        <h2>Security</h2>
        <p>
          Sensitive credentials are protected, and administrative access is
          limited to authorized operators.
        </p>
        <h2>Contact</h2>
        <p>
          For privacy questions, contact the workspace administrator or
          HyperOptimal Metrics support.
        </p>
      </article>
    </main>
  );
}
