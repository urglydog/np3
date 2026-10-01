import { redirect } from 'next/navigation';
import { currentTaskId, groupTasksByPhase } from '@roadmap/core';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { loadPublishedTemplateOutline } from '@/lib/template';
import { buildRoadmapRows } from '@/lib/roadmap';
import { copy } from '@/lib/copy';
import { AppError } from '@/lib/errors';
import { TaskRow } from '@/components/task-row';
import { TaskActions } from '@/components/task-actions';
import { breakAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; conflict?: string; clamped?: string; noop?: string }>;
}) {
  const { error, ok, conflict, clamped, noop } = await searchParams;

  const plan = await loadCurrentPlanSchedule();
  if (!plan) redirect('/create-plan');

  const outline = await loadPublishedTemplateOutline();
  if (!outline) throw new AppError('Chưa có template nào được xuất bản', 'no_template', 500);

  const rows = buildRoadmapRows(outline.tasks, plan.schedule.tasks, plan.pinnedStartById);
  const currentId = currentTaskId(plan.schedule.tasks);
  const groups = groupTasksByPhase(outline.phases, rows);

  const doneCount = rows.filter((r) => r.status === 'done').length;
  const optionalOffCount = rows.filter((r) => r.status === 'skipped').length;
  const totalNotSkipped = rows.length - optionalOffCount;

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">{copy.roadmapTitle}</h1>

      {error ? (
        <p className="rounded-md border border-red-600 p-3 text-sm text-red-600">{decodeURIComponent(error)}</p>
      ) : null}
      {ok === '1' ? (
        <div className="flex flex-col gap-1 rounded-md border border-line p-3 text-sm text-ink">
          <p>{noop === '1' ? copy.scheduleNoTaskAffected : copy.scheduleActionSuccess}</p>
          {conflict === '1' ? <p className="text-ink-muted">{copy.scheduleConflictWarning}</p> : null}
          {clamped === '1' ? <p className="text-ink-muted">{copy.scheduleClampedWarning}</p> : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-1">
        <p className="text-sm text-ink">{copy.roadmapDoneCount(doneCount, totalNotSkipped)}</p>
        {optionalOffCount > 0 ? (
          <p className="text-xs text-ink-faint">{copy.roadmapOptionalOffCount(optionalOffCount)}</p>
        ) : null}
        {plan.schedule.finish ? <p className="text-xs text-ink-muted">{copy.todayFinishLabel(plan.schedule.finish)}</p> : null}
        {currentId ? (
          <a href={`#task-${currentId}`} className="text-sm text-accent underline">
            {copy.roadmapJumpToCurrent}
          </a>
        ) : null}
      </section>

      <details className="rounded-md border border-line">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink">{copy.scheduleBreakTitle}</summary>
        <form action={breakAction} className="flex flex-wrap items-end gap-2 p-3 pt-0">
          <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
            {copy.scheduleBreakFromLabel}
            <input type="date" name="fromDate" required className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
            {copy.scheduleBreakDaysLabel}
            <input
              type="number"
              name="days"
              min="1"
              step="1"
              required
              className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
            />
          </label>
          <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white">
            {copy.scheduleBreakSubmit}
          </button>
        </form>
      </details>

      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const containsCurrent = currentId ? g.tasks.some((t) => t.id === currentId) : false;
          return (
            <details key={g.code} open={containsCurrent} className="rounded-md border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink">{g.title}</summary>
              <ul className="flex flex-col gap-2 p-3 pt-0">
                {g.tasks.map((row) => (
                  <TaskRow key={row.id} row={row} isCurrent={row.id === currentId} actions={<TaskActions row={row} />} />
                ))}
              </ul>
            </details>
          );
        })}
      </div>

      <p className="text-xs text-ink-faint">{copy.hoursEstimateDisclaimer}</p>
    </main>
  );
}
