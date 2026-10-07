import { redirect } from 'next/navigation';
import { currentTaskId, groupTasksByPhase } from '@roadmap/core';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { loadPublishedTemplateOutline } from '@/lib/template';
import { buildRoadmapRows } from '@/lib/roadmap';
import { copy } from '@/lib/copy';
import { AppError } from '@/lib/errors';
import { RoadmapFilter } from '@/components/roadmap-filter';
import { SubmitButton } from '@/components/submit-button';
import { breakAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; conflict?: string; clamped?: string; noop?: string }>;
}) {
  const { error, ok, conflict, clamped, noop } = await searchParams;

  const [plan, outline] = await Promise.all([loadCurrentPlanSchedule(), loadPublishedTemplateOutline()]);
  if (!plan) redirect('/create-plan');
  if (!outline) throw new AppError('Chưa có template nào được xuất bản', 'no_template', 500);

  const rows = buildRoadmapRows(outline.tasks, plan.schedule.tasks, plan.pinnedStartById);
  const currentId = currentTaskId(plan.schedule.tasks);
  const groups = groupTasksByPhase(outline.phases, rows);

  const doneCount = rows.filter((r) => r.status === 'done').length;
  const optionalOffCount = rows.filter((r) => r.status === 'skipped').length;
  const totalNotSkipped = rows.length - optionalOffCount;

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <h1 className="pb-1 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand to-success">
          {copy.roadmapTitle}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-ink bg-surface-raised px-3 py-1 rounded-full border border-line shadow-sm">
            {copy.roadmapDoneCount(doneCount, totalNotSkipped)}
          </span>
          {optionalOffCount > 0 ? (
            <span className="text-ink-muted bg-surface-raised px-3 py-1 rounded-full border border-line shadow-sm">
              {copy.roadmapOptionalOffCount(optionalOffCount)}
            </span>
          ) : null}
          {plan.schedule.finish ? (
            <span className="font-medium bg-brand/10 text-brand px-3 py-1 rounded-full border border-brand/20">
              {copy.todayFinishLabel(plan.schedule.finish)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Alerts */}
      {error ? (
        <div className="rounded-xl border border-danger bg-danger/5 p-4 text-sm text-danger flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {decodeURIComponent(error)}
        </div>
      ) : null}
      {ok === '1' ? (
        <div className="flex flex-col gap-1 rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-ink shadow-sm">
          <p className="font-medium text-success flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            {noop === '1' ? copy.scheduleNoTaskAffected : copy.scheduleActionSuccess}
          </p>
          {conflict === '1' ? <p className="text-warning mt-1">{copy.scheduleConflictWarning}</p> : null}
          {clamped === '1' ? <p className="text-warning mt-1">{copy.scheduleClampedWarning}</p> : null}
        </div>
      ) : null}

      {/* Jump to current + Break dropdown */}
      <div className="flex items-center justify-between gap-4">
        {currentId ? (
          <a href={`#task-${currentId}`} className="btn-primary text-sm shadow-md">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {copy.roadmapJumpToCurrent}
          </a>
        ) : <div />}

        <details className="group relative">
          <summary className="btn-premium cursor-pointer list-none select-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
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
                <input type="number" name="days" min="1" step="1" required className="input-premium" />
              </label>
              <SubmitButton className="btn-primary w-full">{copy.scheduleBreakSubmit}</SubmitButton>
            </form>
          </div>
        </details>
      </div>

      {/* Client-side search/filter + task groups */}
      <RoadmapFilter groups={groups} currentId={currentId ?? null} />

      <p className="text-xs text-ink-faint mt-4 text-center">{copy.hoursEstimateDisclaimer}</p>
    </main>
  );
}
