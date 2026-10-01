'use client';

import { useActionState } from 'react';
import { previewImportAction, confirmImportAction, type ImportState } from '@/app/(app)/settings/backup-actions';
import { copy } from '@/lib/copy';

const initialState: ImportState = { step: 'idle' };

export function BackupImportForm() {
  const [previewState, previewFormAction, previewPending] = useActionState(previewImportAction, initialState);
  const [confirmState, confirmFormAction, confirmPending] = useActionState(confirmImportAction, initialState);

  const state = confirmState.step !== 'idle' ? confirmState : previewState;

  if (state.step === 'preview') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-line p-3">
        <p className="text-sm font-medium text-ink">{copy.backupPreviewTitle}</p>
        <p className="text-sm text-red-600">{copy.backupOverwriteWarning}</p>
        <p className="text-sm text-ink-muted">{copy.backupPreviewPlan(state.summary.templateSlug, state.summary.startDate)}</p>
        <p className="text-sm text-ink-muted">{copy.backupPreviewCounts(state.summary.totalTasks)}</p>
        <ul className="text-xs text-ink-faint">
          {Object.entries(state.summary.countByStatus).map(([status, count]) => (
            <li key={status}>
              {status}: {count}
            </li>
          ))}
        </ul>
        <form action={confirmFormAction} className="flex gap-2">
          <input type="hidden" name="rawJson" value={state.rawJson} />
          <button type="submit" disabled={confirmPending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {copy.backupConfirmSubmit}
          </button>
          <a href="/settings" className="rounded-md border border-line px-4 py-2 text-sm text-ink">
            {copy.backupCancelLink}
          </a>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form action={previewFormAction} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {copy.backupFileLabel}
          <input type="file" name="file" accept="application/json" required className="text-sm" />
        </label>
        <button type="submit" disabled={previewPending} className="self-start rounded-md border border-line px-4 py-2 text-sm text-ink disabled:opacity-60">
          {copy.backupPreviewSubmit}
        </button>
      </form>
      {state.step === 'error' ? (
        <div className="rounded-md border border-red-600 p-3 text-sm text-red-600">
          <p className="font-medium">{copy.backupErrorsTitle}</p>
          <ul className="list-inside list-disc">
            {state.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
