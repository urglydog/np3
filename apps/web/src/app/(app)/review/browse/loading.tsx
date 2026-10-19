export default function ReviewBrowseLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-surface-raised border-b border-line pb-4" />
      <div className="h-8 rounded-lg bg-line" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-line" />
        ))}
      </div>
    </main>
  );
}
