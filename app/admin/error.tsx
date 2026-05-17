"use client";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="admin-shell">
      <section className="admin-main">
        <div className="admin-error-state">
          <h1>Admin dashboard unavailable</h1>
          <p>Refresh the page or try again in a moment.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
