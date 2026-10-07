export default function UpcomingLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6 animate-pulse">
      <div className="flex flex-col gap-1 border-b border-line pb-4">
        <div className="h-8 w-40 rounded-lg bg-surface-raised" />
        <div className="h-4 w-24 rounded-lg bg-surface-raised" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl border border-line bg-surface-raised" />
      ))}
    </main>
  );
}
