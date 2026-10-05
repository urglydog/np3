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
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6 pb-24 relative">
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink bg-clip-text text-transparent bg-gradient-to-r from-brand to-accent">{copy.roadmapTitle}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <p className="font-medium text-ink bg-surface-raised px-3 py-1 rounded-full border border-line shadow-sm">{copy.roadmapDoneCount(doneCount, totalNotSkipped)}</p>
          {optionalOffCount > 0 ? (
            <p className="text-ink-muted bg-surface-raised px-3 py-1 rounded-full border border-line shadow-sm">{copy.roadmapOptionalOffCount(optionalOffCount)}</p>
          ) : null}
          {plan.schedule.finish ? <p className="text-ink-muted font-medium bg-brand/10 text-brand px-3 py-1 rounded-full border border-brand/20">{copy.todayFinishLabel(plan.schedule.finish)}</p> : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger bg-danger/5 p-4 text-sm text-danger flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {decodeURIComponent(error)}
        </div>
      ) : null}
      {ok === '1' ? (
        <div className="flex flex-col gap-1 rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-ink shadow-sm">
          <p className="font-medium text-success flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            {noop === '1' ? copy.scheduleNoTaskAffected : copy.scheduleActionSuccess}
          </p>
          {conflict === '1' ? <p className="text-warning mt-1">{copy.scheduleConflictWarning}</p> : null}
          {clamped === '1' ? <p className="text-warning mt-1">{copy.scheduleClampedWarning}</p> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        {currentId ? (
          <a href={`#task-${currentId}`} className="btn-primary text-sm shadow-md">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
            {copy.roadmapJumpToCurrent}
          </a>
        ) : <div/>}
        
        <details className="group relative z-10">
          <summary className="btn-premium cursor-pointer list-none select-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            {copy.scheduleBreakTitle}
          </summary>
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-line bg-surface-raised p-4 shadow-xl glass z-20">
            <form action={breakAction} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                {copy.scheduleBreakFromLabel}
                <input type="date" name="fromDate" required className="input-premium" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                {copy.scheduleBreakDaysLabel}
                <input
                  type="number"
                  name="days"
                  min="1"
                  step="1"
                  required
                  className="input-premium"
                />
              </label>
              <button type="submit" className="btn-primary w-full">
                {copy.scheduleBreakSubmit}
              </button>
            </form>
          </div>
        </details>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map((g) => {
          const containsCurrent = currentId ? g.tasks.some((t) => t.id === currentId) : false;
          return (
            <details key={g.code} open={containsCurrent} className="group rounded-2xl border border-line bg-surface shadow-sm overflow-hidden transition-all open:ring-1 open:ring-line">
              <summary className="flex cursor-pointer items-center justify-between bg-surface-raised px-5 py-4 text-lg font-bold text-ink hover:bg-line/50 transition-colors select-none">
                {g.title}
                <span className="text-ink-faint transition-transform group-open:rotate-180">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </span>
              </summary>
              <ul className="flex flex-col gap-4 p-5 bg-surface/50 border-t border-line">
                {g.tasks.map((row) => (
                  <TaskRow key={row.id} row={row} isCurrent={row.id === currentId} actions={<TaskActions row={row} />} />
                ))}
              </ul>
            </details>
          );
        })}
      </div>

      <p className="text-xs text-ink-faint mt-8 text-center">{copy.hoursEstimateDisclaimer}</p>

      {/* Floating Action Buttons for quick navigation */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        <a href="#" className="btn-premium rounded-full w-12 h-12 p-0 shadow-lg !bg-surface flex items-center justify-center opacity-80 hover:opacity-100" title="Về đầu trang">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
        </a>
      </div>
    </main>
  );
}
