import { copy } from '@/lib/copy';
import { recordTrackingAction } from '@/app/(app)/today/actions';

export function TrackingForm({
  taskId,
  writingTarget,
  writingReps,
  kanaAccuracy,
  speakingMinutes,
  redirectTo,
}: {
  taskId: string;
  writingTarget: number;
  writingReps: number;
  kanaAccuracy: number | null;
  speakingMinutes: number;
  redirectTo: '/today' | '/roadmap';
}) {
  return (
    <form action={recordTrackingAction} className="flex flex-col gap-2 border-t border-line pt-2">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
          {copy.trackingWritingRepsLabel(writingTarget)}
          <input
            type="number"
            name="writingReps"
            min="0"
            step="1"
            required
            defaultValue={writingReps}
            className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
          {copy.trackingKanaAccuracyLabel}
          <input
            type="number"
            name="kanaAccuracy"
            min="0"
            max="100"
            step="1"
            required
            defaultValue={kanaAccuracy != null ? Math.round(kanaAccuracy * 100) : undefined}
            className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
          {copy.trackingSpeakingMinutesLabel}
          <input
            type="number"
            name="speakingMinutes"
            min="0"
            step="1"
            required
            defaultValue={speakingMinutes}
            className="w-24 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
          />
        </label>
      </div>
      <button type="submit" className="self-start rounded-md border border-line px-3 py-1.5 text-xs text-ink">
        {copy.trackingSubmit}
      </button>
    </form>
  );
}
