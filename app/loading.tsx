export default function Loading() {
  return (
    <main className="app-status-page" aria-live="polite" aria-busy="true">
      <section className="app-status-card">
        <div className="app-status-skeleton" aria-hidden="true" />
        <p>Loading workspace</p>
      </section>
    </main>
  );
}

