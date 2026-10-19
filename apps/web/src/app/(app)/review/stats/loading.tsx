export default function ReviewStatsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface-raised border-b border-line pb-4" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-line" />
        ))}
      </div>
      <div className="h-32 rounded-2xl bg-line" />
      <div className="h-32 rounded-2xl bg-line" />
    </main>
  );
}
