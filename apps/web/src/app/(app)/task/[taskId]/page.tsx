import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadTaskDetail } from '@/lib/task-detail';
import { copy } from '@/lib/copy';
import { TaskActions } from '@/components/task-actions';
import { BackLink } from '@/components/back-link';
import { SubmitButton } from '@/components/submit-button';
import { updateTaskStatsAction } from './actions';

export const dynamic = 'force-dynamic';

const statusLabel: Record<string, string> = {
  todo: copy.roadmapStatusTodo,
  in_progress: copy.roadmapStatusInProgress,
  done: copy.roadmapStatusDone,
  skipped: copy.roadmapStatusSkipped,
};

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { taskId } = await params;
  const { ok, error } = await searchParams;
  const task = await loadTaskDetail(taskId);
  if (!task) notFound();

  return (
    <main className="mx-auto flex w-full max-w-screen-sm flex-col gap-6 p-4 md:p-6 pb-24">
      <BackLink label={copy.taskDetailBackLink} />

      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-2xl font-bold break-words text-ink">
            {task.name}
            {task.optional ? <span className="ml-2 inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-faint border border-line align-middle">{copy.roadmapOptionalTag}</span> : null}
          </h1>
          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            task.status === 'done' ? 'bg-success/10 text-success border border-success/20' :
            task.status === 'in_progress' ? 'bg-brand/10 text-brand border border-brand/20' :
            'bg-surface text-ink-muted border border-line'
          }`}>
            {statusLabel[task.status]}
          </span>
        </div>
        {task.milestone ? <p className="text-sm text-ink-muted">{task.milestone}</p> : null}
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4">
        {task.deliverable ? (
          <p className="text-sm text-ink"><span className="font-medium text-ink-muted">{copy.taskDetailDeliverableLabel}: </span>{task.deliverable}</p>
        ) : null}
        {task.toolNote ? (
          <p className="text-sm text-ink"><span className="font-medium text-ink-muted">{copy.taskDetailToolNoteLabel}: </span>{task.toolNote}</p>
        ) : null}
        <p className="text-sm text-ink-muted">{copy.roadmapEstHoursLabel(task.estHours)}</p>
        {task.writingTarget > 0 ? (
          <p className="text-sm text-ink-muted">{copy.taskDetailWritingTargetLabel(task.writingTarget)}</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-ink">{copy.taskDetailStatsTitle}</h2>
        {error ? <p className="text-sm text-danger">{decodeURIComponent(error)}</p> : null}
        {ok ? <p className="text-sm text-success">{copy.taskDetailStatsSaved}</p> : null}
        <form action={updateTaskStatsAction} className="flex flex-col gap-3">
          <input type="hidden" name="taskId" value={task.id} />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {copy.taskDetailWritingRepsLabel}
            <input type="number" name="writingReps" min="0" step="1" defaultValue={task.writingReps} className="input-premium" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {copy.taskDetailSpeakingMinutesLabel}
            <input type="number" name="speakingMinutes" min="0" step="1" defaultValue={task.speakingMinutes} className="input-premium" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {copy.taskDetailKanaAccuracyLabel}
            <input
              type="number"
              name="kanaAccuracyPercent"
              min="0"
              max="100"
              step="1"
              defaultValue={task.kanaAccuracy === null ? undefined : Math.round(task.kanaAccuracy * 100)}
              className="input-premium"
            />
          </label>
          <SubmitButton className="btn-primary w-full">{copy.taskDetailStatsSubmit}</SubmitButton>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface-raised p-4">
        <TaskActions
          row={{
            id: task.id,
            code: task.code,
            name: task.name,
            sort: task.sort,
            phaseCode: '',
            status: task.status,
            optional: task.optional,
            estHours: task.estHours,
            start: null,
            due: null,
            pinnedStart: task.pinnedStart,
          }}
        />
      </section>

      <div className="flex items-center justify-between text-sm">
        {task.prevTaskId ? (
          <Link href={`/task/${task.prevTaskId}`} className="text-brand hover:underline">{copy.taskDetailPrevTask}</Link>
        ) : <span />}
        {task.nextTaskId ? (
          <Link href={`/task/${task.nextTaskId}`} className="text-brand hover:underline">{copy.taskDetailNextTask}</Link>
        ) : <span />}
      </div>
    </main>
  );
}
