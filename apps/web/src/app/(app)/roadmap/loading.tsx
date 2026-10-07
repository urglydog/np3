export default function RoadmapLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6 animate-pulse">
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <div className="h-8 w-40 rounded-lg bg-surface-raised" />
        <div className="h-4 w-56 rounded-lg bg-surface-raised" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-4">
          <div className="h-5 w-32 rounded-lg bg-line" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="h-12 rounded-xl bg-line" />
          ))}
        </div>
      ))}
    </main>
  );
}
