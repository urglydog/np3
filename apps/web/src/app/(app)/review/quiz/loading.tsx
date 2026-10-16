export default function QuizLoading() {
  return (
    <main className="mx-auto flex w-full max-w-screen-sm animate-pulse flex-col gap-4 p-4 md:p-6">
      <div className="h-4 w-24 rounded bg-surface-raised" />
      <div className="h-1.5 rounded-full bg-line" />
      <div className="h-32 rounded-2xl border border-line bg-surface-raised" />
      <div className="h-12 rounded-xl border border-line bg-surface-raised" />
    </main>
  );
}
