import { redirect } from 'next/navigation';
import { currentTaskId, groupTasksByPhase } from '@roadmap/core';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { loadPublishedTemplateOutline } from '@/lib/template';
import { loadProgressStats } from '@/lib/progress';
import { buildRoadmapRows } from '@/lib/roadmap';
import { copy } from '@/lib/copy';
import { AppError } from '@/lib/errors';
import { RoadmapFilter } from '@/components/roadmap-filter';
import { AnchorDetailsOpener } from '@/components/anchor-details-opener';
import { BreakPopover } from '@/components/break-popover';
import { ProgressRings } from '@/components/progress-rings';

export const dynamic = 'force-dynamic';

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; conflict?: string; clamped?: string; noop?: string }>;
}) {
  const { error, ok, conflict, clamped, noop } = await searchParams;

  const [plan, outline, progressStats] = await Promise.all([
    loadCurrentPlanSchedule(),
    loadPublishedTemplateOutline(),
    loadProgressStats(),
  ]);
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
      <AnchorDetailsOpener />
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

      {/* Vòng tròn tiến độ + thống kê viết/nói theo milestone */}
      {progressStats && progressStats.totalTasks > 0 ? (
        <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm">
          <ProgressRings stats={progressStats} />
          {progressStats.byMilestone.length > 0 ? (
            <details className="mt-4 group">
              <summary className="cursor-pointer text-sm font-medium text-ink-muted hover:text-ink select-none list-none">
                {copy.progressStatsTitle}
              </summary>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {progressStats.byMilestone.map((m) => (
                  <li key={m.milestone} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="font-medium text-ink">{m.milestone}</span>
                    <span className="text-ink-muted text-xs">
                      {m.doneCount}/{m.taskCount} xong · {copy.progressStatsWriting(m.totalWritingReps)} · {copy.progressStatsSpeaking(m.totalSpeakingMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

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

        <BreakPopover />
      </div>

      {/* Client-side search/filter + task groups */}
      <RoadmapFilter groups={groups} currentId={currentId ?? null} />

      <p className="text-xs text-ink-faint mt-4 text-center">{copy.hoursEstimateDisclaimer}</p>
    </main>
  );
}
