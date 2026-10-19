export default function KanjiDetailLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6 animate-pulse">
      <div className="h-4 w-20 rounded-lg bg-surface-raised" />
      <div className="h-48 rounded-2xl bg-line" />
      <div className="h-24 rounded-2xl bg-line" />
      <div className="h-56 rounded-2xl bg-line" />
      <div className="h-32 rounded-2xl bg-line" />
    </main>
  );
}
