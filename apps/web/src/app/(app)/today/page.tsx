import { redirect } from 'next/navigation';
import { currentTaskId } from '@roadmap/core';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { buildPhraseMatrix } from '@/lib/roadmap';
import { copy } from '@/lib/copy';
import { PhraseMatrix } from '@/components/phrase-matrix';
import { TodayCarousel, type CarouselTask } from '@/components/today-carousel';

export const dynamic = 'force-dynamic';

const WINDOW = 3; // số task trước/sau task hiện tại hiện trong carousel

export default async function TodayPage() {
  const plan = await loadCurrentPlanSchedule();
  if (!plan) redirect('/create-plan');

  const { schedule, taskInfoById } = plan;
  const currentId = currentTaskId(schedule.tasks);
  const activeTasks = schedule.tasks.filter((t) => t.status !== 'skipped');
  const currentIdx = currentId ? activeTasks.findIndex((t) => t.id === currentId) : -1;

  const windowStart = currentIdx < 0 ? 0 : Math.max(0, currentIdx - WINDOW);
  const windowEnd = currentIdx < 0 ? 0 : Math.min(activeTasks.length, currentIdx + WINDOW + 1);
  const carouselTasks: CarouselTask[] = activeTasks.slice(windowStart, windowEnd).map((t) => ({
    id: t.id,
    name: taskInfoById.get(t.id)?.name ?? t.id,
    milestone: taskInfoById.get(t.id)?.milestone ?? null,
    due: t.due,
    status: t.status,
    isCurrent: t.id === currentId,
  }));
  const carouselStartIndex = currentIdx < 0 ? 0 : currentIdx - windowStart;
  const phraseGroups = buildPhraseMatrix(schedule.tasks, taskInfoById);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 p-4 py-10">
      <div className="flex flex-col items-center text-center gap-2">
        {/* pb-2 prevents gradient text bottom clip */}
        <h1 className="pb-2 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand to-success">
          {copy.todayTitle}
        </h1>
        {schedule.finish ? <p className="text-sm font-medium text-ink-muted">{copy.todayFinishLabel(schedule.finish)}</p> : null}
        {schedule.requiredHoursPerDayFor365 != null ? (
          <p className="text-sm font-medium text-warning drop-shadow-sm">{copy.todayRequiredHoursLabel(schedule.requiredHoursPerDayFor365)}</p>
        ) : null}
      </div>

      {carouselTasks.length > 0 ? (
        <TodayCarousel tasks={carouselTasks} startIndex={carouselStartIndex} />
      ) : (
        <div className="glass flex w-full flex-col items-center justify-center gap-4 rounded-2xl p-10 text-center shadow-xl">
          <div className="rounded-full bg-success/20 p-4">
            <svg className="w-12 h-12 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-ink">Hoàn thành xuất sắc!</h2>
          <p className="text-sm text-ink-muted">{copy.todayEmptyState}</p>
        </div>
      )}

      <p className="text-xs text-ink-faint">{copy.hoursEstimateDisclaimer}</p>

      {phraseGroups.length > 0 ? (
        <details className="group w-full">
          <summary className="cursor-pointer select-none list-none text-center text-sm font-medium text-ink-muted hover:text-ink">
            {copy.todayPhraseMatrixTitle}
          </summary>
          <div className="mt-4">
            <PhraseMatrix groups={phraseGroups} />
          </div>
        </details>
      ) : null}
    </main>
  );
}
