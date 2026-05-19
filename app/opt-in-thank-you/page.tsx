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

export default async function OptInThankYouPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const email = getParam(params, "email");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-success-icon ok" aria-hidden="true">✓</div>
        <div className="auth-heading">
          <h1>You&apos;re in</h1>
          <p>
            {email
              ? `We saved ${email} and will send the next step there.`
              : "We saved your request and will send the next step to your inbox."}
          </p>
        </div>
      </section>
    </main>
  );
}
