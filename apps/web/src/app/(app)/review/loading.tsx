export default function ReviewHomeLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6 animate-pulse">
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <div className="h-8 w-40 rounded-lg bg-surface-raised" />
      </div>
      <div className="h-44 rounded-2xl border border-line bg-surface-raised" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 rounded-xl bg-line" />
        <div className="h-16 rounded-xl bg-line" />
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-line" />
        ))}
      </div>
    </main>
  );
}
