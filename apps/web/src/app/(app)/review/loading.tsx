export default function ReviewLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md animate-pulse flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-4">
        <div className="h-8 w-48 rounded-lg bg-surface-raised" />
        <div className="h-4 w-56 rounded-lg bg-surface-raised" />
      </div>
      <div className="h-28 rounded-2xl border border-line bg-surface-raised" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-xl border border-line bg-surface-raised" />
      ))}
    </main>
  );
}
