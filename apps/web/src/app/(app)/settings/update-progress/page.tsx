import Link from 'next/link';
import { tasksToMarkDone, nextTaskAfter, type Status } from '@roadmap/core';
import { createClient } from '@/lib/supabase/server';
import { loadPublishedTemplateOutline } from '@/lib/template';
import { copy } from '@/lib/copy';
import { AppError } from '@/lib/errors';
import { applyProgressUpdate } from './actions';
import { SubmitButton } from '@/components/submit-button';

export const dynamic = 'force-dynamic';

export default async function UpdateProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; updated?: string }>;
}) {
  const { code, updated } = await searchParams;

  if (updated !== undefined) {
    return (
      <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold text-ink">{copy.updateProgressTitle}</h1>
        <p className="text-sm text-ink">{copy.updateProgressResult(Number(updated) || 0)}</p>
        <Link href="/today" className="text-sm text-accent underline">
          {copy.todayTitle}
        </Link>
      </main>
    );
  }

  const outline = await loadPublishedTemplateOutline();
  if (!outline) throw new AppError('Chưa có template nào được xuất bản', 'no_template', 500);

  const supabase = await createClient();
  const { data: planTaskStates } = await supabase.from('plan_task_state').select('task_id, status');
  const statusByTaskId = new Map((planTaskStates ?? []).map((s) => [s.task_id, s.status as Status]));
  const progressRows = outline.tasks.map((t) => ({ id: t.id, sort: t.sort, status: statusByTaskId.get(t.id) ?? 'todo' }));

  const tasksByPhase = new Map<string, typeof outline.tasks>();
  for (const t of outline.tasks) {
    const list = tasksByPhase.get(t.phaseCode) ?? [];
    list.push(t);
    tasksByPhase.set(t.phaseCode, list);
  }

  if (!code) {
    return (
      <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold text-ink">{copy.updateProgressTitle}</h1>
        <form method="get" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            {copy.updateProgressSelectLabel}
            <select name="code" required className="rounded-md border border-line bg-surface px-3 py-2 text-ink">
              {outline.phases.map((phase) => (
                <optgroup key={phase.code} label={phase.title}>
                  {(tasksByPhase.get(phase.code) ?? []).map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <SubmitButton className="btn-primary">
            {copy.updateProgressPreviewSubmit}
          </SubmitButton>
        </form>
      </main>
    );
  }

  const target = outline.tasks.find((t) => t.code === code);
  if (!target) {
    return (
      <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold text-ink">{copy.updateProgressTitle}</h1>
        <p className="text-sm text-red-600">Mã task không hợp lệ.</p>
        <Link href="/settings/update-progress" className="text-sm text-accent underline">
          {copy.updateProgressChooseAgain}
        </Link>
      </main>
    );
  }

  const idsToMark = tasksToMarkDone(progressRows, target.sort);
  const nameById = new Map(outline.tasks.map((t) => [t.id, t.name]));
  const next = nextTaskAfter(progressRows, target.sort);

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">{copy.updateProgressTitle}</h1>

      {idsToMark.length === 0 ? (
        <p className="text-sm text-ink-muted">{copy.updateProgressConfirmNone}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink">{copy.updateProgressConfirmCount(idsToMark.length)}</p>
          <p className="text-sm text-ink-muted">
            {copy.updateProgressConfirmRange(
              nameById.get(idsToMark[0]) ?? '',
              nameById.get(idsToMark[idsToMark.length - 1]) ?? ''
            )}
          </p>
        </div>
      )}

      <p className="text-sm text-ink-muted">
        {next ? copy.updateProgressNextTaskLabel(next ? (nameById.get(next.id) ?? '') : '') : copy.updateProgressAllDoneLabel}
      </p>

      <div className="flex gap-3">
        {idsToMark.length > 0 ? (
          <form action={applyProgressUpdate}>
            <input type="hidden" name="code" value={code} />
            <SubmitButton className="btn-primary">
              {copy.updateProgressConfirmSubmit}
            </SubmitButton>
          </form>
        ) : null}
        <Link href="/settings/update-progress" className="btn-premium">
          {copy.updateProgressChooseAgain}
        </Link>
      </div>
    </main>
  );
}
