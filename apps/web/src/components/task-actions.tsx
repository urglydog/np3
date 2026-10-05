import type { RoadmapRow } from '@/lib/roadmap';
import { copy } from '@/lib/copy';
import { toggleSkipAction, delayAction, pinAction, unpinAction } from '@/app/(app)/roadmap/actions';

/** Nút/form thao tác cho 1 task trên /roadmap. Ẩn hoàn toàn với task đã Xong. */
export function TaskActions({ row }: { row: RoadmapRow }) {
  if (row.status === 'done') return null;

  if (row.status === 'skipped') {
    return (
      <form action={toggleSkipAction} className="flex">
        <input type="hidden" name="taskId" value={row.id} />
        <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
          {copy.scheduleUnskipButton}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={toggleSkipAction} className="flex">
        <input type="hidden" name="taskId" value={row.id} />
        <button type="submit" className="btn-premium py-1.5 px-3 text-xs flex-1">
          {copy.scheduleSkipButton}
        </button>
      </form>

      <div className="flex flex-wrap items-start gap-4 border-t border-line/50 pt-3">
        <form action={delayAction} className="flex items-end gap-2 flex-1 min-w-[140px]">
          <input type="hidden" name="taskId" value={row.id} />
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-muted w-full">
            {copy.scheduleDelayLabel}
            <div className="flex gap-2">
              <input
                type="number"
                name="days"
                min="1"
                step="1"
                required
                className="input-premium py-1.5 px-2 w-16"
              />
              <button type="submit" className="btn-premium py-1.5 px-3 text-xs flex-1">
                {copy.scheduleDelaySubmit}
              </button>
            </div>
          </label>
        </form>

        <form action={pinAction} className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <input type="hidden" name="taskId" value={row.id} />
          <span className="text-xs font-medium text-ink-muted">{copy.schedulePinLabel}</span>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              name="date"
              required
              defaultValue={row.pinnedStart ?? undefined}
              className="input-premium py-1.5 px-2 flex-1"
            />
            <button type="submit" className="btn-premium py-1.5 px-3 text-xs">
              {copy.schedulePinSubmit}
            </button>
          </div>
        </form>
      </div>

      {row.pinnedStart ? (
        <form action={unpinAction} className="flex mt-1 border-t border-line/50 pt-3">
          <input type="hidden" name="taskId" value={row.id} />
          <button type="submit" className="btn-premium border-danger/30 text-danger hover:bg-danger/10 py-1.5 px-3 text-xs w-full">
            <svg className="w-4 h-4 mr-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            {copy.scheduleUnpinSubmit}
          </button>
        </form>
      ) : null}
    </div>
  );
}
