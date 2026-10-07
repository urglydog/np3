export default function SettingsLoading() {
  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-6 p-4 animate-pulse">
      <div className="h-7 w-24 rounded-lg bg-surface-raised" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="h-4 w-32 rounded-lg bg-surface-raised" />
          <div className="h-20 rounded-xl border border-line bg-surface-raised" />
        </div>
      ))}
    </main>
  );
}
