'use client';

import { useActionState } from 'react';
import { createPlan, type CreatePlanState } from './actions';
import { copy } from '@/lib/copy';
import type { TemplateOutline } from '@/lib/template';

const initialState: CreatePlanState = { error: null };

export function CreatePlanForm({ outline }: { outline: TemplateOutline }) {
  const [state, formAction, pending] = useActionState(createPlan, initialState);
  const tasksByPhase = new Map<string, typeof outline.tasks>();
  for (const t of outline.tasks) {
    const list = tasksByPhase.get(t.phaseCode) ?? [];
    list.push(t);
    tasksByPhase.set(t.phaseCode, list);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">{copy.createPlanPackageLabel}</legend>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="radio" name="package" value="425" defaultChecked required className="mt-1" />
          {copy.createPlanPackageCore}
        </label>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="radio" name="package" value="566" required className="mt-1" />
          {copy.createPlanPackageFull}
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {copy.createPlanStartDateLabel}
        <input type="date" name="startDate" required className="rounded-md border border-line bg-surface px-3 py-2 text-ink" />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {copy.createPlanHoursPerDayLabel}
        <input
          type="number"
          name="hoursPerDay"
          step="0.5"
          min="0.5"
          max="16"
          required
          defaultValue={2}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {copy.createPlanDaysPerWeekLabel}
        <input
          type="number"
          name="daysPerWeek"
          step="1"
          min="1"
          max="7"
          required
          defaultValue={6}
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        />
      </label>

      <input type="hidden" name="timezone" value="Asia/Ho_Chi_Minh" />
      <p className="text-xs text-ink-faint">{copy.createPlanTimezoneLabel}: Asia/Ho_Chi_Minh</p>

      <label className="flex flex-col gap-1 text-sm text-ink">
        {copy.createPlanDoneUpToLabel}
        <select
          name="doneUpToTaskCode"
          defaultValue=""
          className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
        >
          <option value="">{copy.createPlanDoneUpToNone}</option>
          {outline.phases.map((phase) => (
            <optgroup key={phase.code} label={phase.title}>
              {(tasksByPhase.get(phase.code) ?? []).map((t) => (
                <option key={t.id} value={t.code}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <p className="text-xs text-ink-faint">{copy.createPlanHoursDisclaimer}</p>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary disabled:opacity-60"
      >
        {copy.createPlanSubmit}
      </button>
    </form>
  );
}
