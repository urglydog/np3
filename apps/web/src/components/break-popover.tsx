'use client';

import { useEffect, useRef, useState } from 'react';
import { copy } from '@/lib/copy';
import { breakAction } from '@/app/(app)/roadmap/actions';
import { SubmitButton } from '@/components/submit-button';

/**
 * Trước đây dùng <details> thuần làm popup — <details> chỉ đóng khi bấm lại <summary>,
 * không tự đóng khi bấm ra ngoài (khác hành vi popup/menu bình thường người dùng mong đợi).
 */
export function BreakPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-premium cursor-pointer select-none"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {copy.scheduleBreakTitle}
      </button>

      {open && (
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
      )}
    </div>
  );
}
