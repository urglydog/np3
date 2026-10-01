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
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <form action={toggleSkipAction} className="flex">
        <input type="hidden" name="taskId" value={row.id} />
        <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
          {copy.scheduleSkipButton}
        </button>
      </form>

      <form action={delayAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="taskId" value={row.id} />
        <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
          {copy.scheduleDelayLabel}
          <input
            type="number"
            name="days"
            min="1"
            step="1"
            required
            className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
          />
        </label>
        <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
          {copy.scheduleDelaySubmit}
        </button>
      </form>

      <form action={pinAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="taskId" value={row.id} />
        <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
          {copy.schedulePinLabel}
          <input
            type="date"
            name="date"
            required
            defaultValue={row.pinnedStart ?? undefined}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
          />
        </label>
        <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
          {copy.schedulePinSubmit}
        </button>
      </form>

      {row.pinnedStart ? (
        <form action={unpinAction} className="flex">
          <input type="hidden" name="taskId" value={row.id} />
          <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
            {copy.scheduleUnpinSubmit}
          </button>
        </form>
      ) : null}
    </div>
  );
}
