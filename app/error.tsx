"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-status-page">
      <section className="app-status-card" role="alert">
        <h1>Something went wrong</h1>
        <p>Refresh the page or try again.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}

