'use client';

import { useId } from 'react';
import { copy } from '@/lib/copy';

// Cùng convention vẽ vòng tròn SVG % với apps/web/src/components/progress-rings.tsx (R, stroke,
// dasharray, gradient qua useId) — ở đây chỉ 1 vòng duy nhất (% mastered tổng), không cần tương tác
// hover nên không cần 'use client'.
const R = 52;
const STROKE = 10;
const C = 2 * Math.PI * R;

export function ReviewMasteryRing({ pct }: { pct: number }) {
  const gradientId = useId();
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-brand)" />
            <stop offset="100%" stopColor="var(--color-success)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line)" strokeWidth={STROKE} />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - clamped / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-ink">{clamped}%</span>
        <span className="text-[10px] text-ink-muted">{copy.reviewMasteredLabel}</span>
      </div>
    </div>
  );
}
