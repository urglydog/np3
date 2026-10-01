import { redirect } from 'next/navigation';
import { currentTaskId } from '@roadmap/core';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { copy } from '@/lib/copy';
import { markTaskDone } from './actions';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const plan = await loadCurrentPlanSchedule();
  if (!plan) redirect('/create-plan');

  const { schedule, taskInfoById } = plan;
  const currentId = currentTaskId(schedule.tasks);
  const current = currentId ? schedule.tasks.find((t) => t.id === currentId) : undefined;
  const info = current ? taskInfoById.get(current.id) : undefined;

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">{copy.todayTitle}</h1>

      {current && info ? (
        <section className="flex flex-col gap-2 rounded-md border border-line p-4">
          {info.milestone ? <p className="text-xs text-ink-faint">{info.milestone}</p> : null}
          <h2 className="text-base font-medium text-ink">{info.name}</h2>
          {current.due ? <p className="text-sm text-ink-muted">Hạn: {current.due}</p> : null}
          <form action={markTaskDone}>
            <input type="hidden" name="taskId" value={current.id} />
            <button
              type="submit"
              className="mt-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              {copy.todayDoneButton}
            </button>
          </form>
        </section>
      ) : (
        <p className="text-sm text-ink-muted">{copy.todayEmptyState}</p>
      )}

      <section className="flex flex-col gap-1 text-sm text-ink-muted">
        {schedule.finish ? <p>{copy.todayFinishLabel(schedule.finish)}</p> : null}
        {schedule.requiredHoursPerDayFor365 != null ? (
          <p>{copy.todayRequiredHoursLabel(schedule.requiredHoursPerDayFor365)}</p>
        ) : null}
      </section>

      <p className="text-xs text-ink-faint">{copy.hoursEstimateDisclaimer}</p>
    </main>
  );
}
