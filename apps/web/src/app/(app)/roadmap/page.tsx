import { redirect } from 'next/navigation';
import { currentTaskId, groupTasksByPhase, type Status } from '@roadmap/core';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { loadPublishedTemplateOutline } from '@/lib/template';
import { buildRoadmapRows, type RoadmapRow } from '@/lib/roadmap';
import { copy } from '@/lib/copy';
import { AppError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const statusLabel: Record<Status, string> = {
  todo: copy.roadmapStatusTodo,
  in_progress: copy.roadmapStatusInProgress,
  done: copy.roadmapStatusDone,
  skipped: copy.roadmapStatusSkipped,
};

function TaskRow({ row, isCurrent }: { row: RoadmapRow; isCurrent: boolean }) {
  const hasDates = row.status === 'todo' || row.status === 'in_progress';
  const dimmed = row.status === 'skipped';
  return (
    <li
      id={`task-${row.id}`}
      className={`flex flex-col gap-1 rounded-md border p-3 ${
        isCurrent ? 'border-accent' : 'border-line'
      } ${dimmed ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-ink">
          {row.name}
          {row.optional ? <span className="ml-1 text-xs text-ink-faint">{copy.roadmapOptionalTag}</span> : null}
        </span>
        <span className="text-xs text-ink-muted">{statusLabel[row.status]}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-faint">
        <span>{copy.roadmapEstHoursLabel(row.estHours)}</span>
        <span>
          {hasDates ? `${row.start ?? copy.roadmapNoDates} → ${row.due ?? copy.roadmapNoDates}` : copy.roadmapNoDates}
        </span>
      </div>
    </li>
  );
}

export default async function RoadmapPage() {
  const plan = await loadCurrentPlanSchedule();
  if (!plan) redirect('/create-plan');

  const outline = await loadPublishedTemplateOutline();
  if (!outline) throw new AppError('Chưa có template nào được xuất bản', 'no_template', 500);

  const rows = buildRoadmapRows(outline.tasks, plan.schedule.tasks);
  const currentId = currentTaskId(plan.schedule.tasks);
  const groups = groupTasksByPhase(outline.phases, rows);

  const doneCount = rows.filter((r) => r.status === 'done').length;
  const optionalOffCount = rows.filter((r) => r.status === 'skipped').length;
  const totalNotSkipped = rows.length - optionalOffCount;

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">{copy.roadmapTitle}</h1>

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

      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const containsCurrent = currentId ? g.tasks.some((t) => t.id === currentId) : false;
          return (
            <details key={g.code} open={containsCurrent} className="rounded-md border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink">{g.title}</summary>
              <ul className="flex flex-col gap-2 p-3 pt-0">
                {g.tasks.map((row) => (
                  <TaskRow key={row.id} row={row} isCurrent={row.id === currentId} />
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
