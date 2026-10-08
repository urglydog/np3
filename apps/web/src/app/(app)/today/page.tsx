import { redirect } from 'next/navigation';
import { currentTaskId } from '@roadmap/core';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { buildPhraseMatrix } from '@/lib/roadmap';
import { copy } from '@/lib/copy';
import { markTaskDone } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { PhraseMatrix } from '@/components/phrase-matrix';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const plan = await loadCurrentPlanSchedule();
  if (!plan) redirect('/create-plan');

  const { schedule, taskInfoById } = plan;
  const currentId = currentTaskId(schedule.tasks);
  const current = currentId ? schedule.tasks.find((t) => t.id === currentId) : undefined;
  const info = current ? taskInfoById.get(current.id) : undefined;
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

      {current && info ? (
        <section className="glass flex w-full flex-col gap-6 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand to-success"></div>
          
          <div className="flex flex-col gap-1">
            {info.milestone ? <p className="text-xs font-semibold uppercase tracking-wider text-brand">{info.milestone}</p> : null}
            <h2 className="text-xl font-bold text-ink drop-shadow-sm">{info.name}</h2>
            {current.due ? (
              <p className="text-sm text-ink-muted flex items-center gap-1 mt-1">
                <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Hạn chót: <span className="font-medium text-ink">{current.due}</span>
              </p>
            ) : null}
          </div>

          <form action={markTaskDone} className="flex flex-col gap-4 mt-2">
            <input type="hidden" name="taskId" value={current.id} />
            
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm text-ink font-medium">
                Số lần viết (nếu có)
                <input 
                  type="number" 
                  name="writingReps" 
                  min="0" 
                  placeholder="VD: 50"
                  className="input-premium mt-1" 
                />
              </label>
              
              <label className="flex flex-col gap-1 text-sm text-ink font-medium">
                Phút luyện nói
                <input 
                  type="number" 
                  name="speakingMinutes" 
                  min="0" 
                  placeholder="VD: 15"
                  className="input-premium mt-1" 
                />
              </label>
            </div>

            <SubmitButton className="btn-primary mt-4 w-full py-3 text-lg font-bold shadow-lg">
              {copy.todayDoneButton}
            </SubmitButton>
          </form>
        </section>
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
