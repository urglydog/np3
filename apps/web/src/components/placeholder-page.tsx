import { copy } from '@/lib/copy';

export function PlaceholderPage({ title, taskId }: { title: string; taskId: string }) {
  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-2 p-4">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="text-sm text-ink-muted">{copy.notImplemented(taskId)}</p>
    </main>
  );
}
