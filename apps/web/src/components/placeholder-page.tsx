export function PlaceholderPage({ title, taskId }: { title: string; taskId: string }) {
  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-2 p-4">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="text-sm text-ink-muted">Chưa triển khai (xem {taskId} trong UpComming_Plan)</p>
    </main>
  );
}
