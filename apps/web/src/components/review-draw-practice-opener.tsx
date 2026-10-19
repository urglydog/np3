'use client';

import { useState } from 'react';
import { PenLine, X } from 'lucide-react';
import type { StrokePath } from '@roadmap/core';
import { copy } from '@/lib/copy';
import { ReviewDrawPractice } from '@/components/review-draw-practice';

/** Kiểm tra thô `stroke_points` (jsonb, có thể null) đúng hình dạng StrokePath[] trước khi dùng — cột
 *  này nullable (M1b chưa chắc đã điền), không được coi thiếu dữ liệu là lỗi. */
function parseStrokePoints(raw: unknown): StrokePath[] | null {
  if (!Array.isArray(raw)) return null;
  const strokes: unknown[] = raw;
  const valid = strokes.every((stroke) => {
    if (!Array.isArray(stroke)) return false;
    return stroke.every((point) => {
      if (typeof point !== 'object' || point === null) return false;
      const p = point as Record<string, unknown>;
      return typeof p.x === 'number' && typeof p.y === 'number';
    });
  });
  return valid && strokes.length > 0 ? (strokes as StrokePath[]) : null;
}

export function ReviewDrawPracticeOpener({ strokePoints }: { strokePoints: unknown | null }) {
  const [open, setOpen] = useState(false);
  const referenceStrokes = parseStrokePoints(strokePoints);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary mt-2 flex items-center gap-1 text-sm">
        <PenLine className="h-4 w-4" />
        {copy.reviewDetailDrawButton}
      </button>
    );
  }

  return (
    <div className="mt-2 flex w-full flex-col items-center gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-medium text-ink">{copy.reviewDetailDrawButton}</span>
        <button type="button" onClick={() => setOpen(false)} title={copy.reviewBrowseCancel} className="text-ink-faint hover:text-danger">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ReviewDrawPractice referenceStrokes={referenceStrokes} />
    </div>
  );
}
