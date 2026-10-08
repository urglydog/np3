'use client';

import { useId, useState } from 'react';
import type { ProgressStats } from '@/lib/progress';
import { copy } from '@/lib/copy';

const R_OUTER = 52;
const R_INNER = 36;
const STROKE = 10;
const C_OUTER = 2 * Math.PI * R_OUTER;
const C_INNER = 2 * Math.PI * R_INNER;

export function ProgressRings({ stats }: { stats: ProgressStats }) {
  const gradientId = useId();
  const [hover, setHover] = useState<'outer' | 'inner' | null>(null);
  const pct = stats.totalTasks === 0 ? 0 : Math.round((stats.doneTasks / stats.totalTasks) * 100);

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-brand)" />
              <stop offset="100%" stopColor="var(--color-success)" />
            </linearGradient>
          </defs>

          {/* Vòng ngoài: tổng số task = 100% */}
          <circle
            cx="60" cy="60" r={R_OUTER} fill="none" stroke="var(--color-line)" strokeWidth={STROKE}
          />
          <circle
            cx="60" cy="60" r={R_OUTER} fill="none" stroke="var(--color-ink-faint)" strokeWidth={STROKE}
            strokeDasharray={C_OUTER} strokeDashoffset={0} strokeLinecap="round"
            className="cursor-pointer transition-opacity" style={{ opacity: hover === 'outer' ? 1 : 0.5 }}
            onMouseEnter={() => setHover('outer')} onMouseLeave={() => setHover(null)}
            onClick={() => setHover((h) => (h === 'outer' ? null : 'outer'))}
          />

          {/* Vòng trong: done/total */}
          <circle
            cx="60" cy="60" r={R_INNER} fill="none" stroke="var(--color-line)" strokeWidth={STROKE}
          />
          <circle
            cx="60" cy="60" r={R_INNER} fill="none" stroke={`url(#${gradientId})`} strokeWidth={STROKE}
            strokeDasharray={C_INNER} strokeDashoffset={C_INNER * (1 - stats.doneTasks / Math.max(stats.totalTasks, 1))}
            strokeLinecap="round" className="cursor-pointer transition-opacity"
            onMouseEnter={() => setHover('inner')} onMouseLeave={() => setHover(null)}
            onClick={() => setHover((h) => (h === 'inner' ? null : 'inner'))}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-ink">{pct}%</span>
          <span className="text-[10px] text-ink-muted">{copy.progressRingDonePercent}</span>
        </div>
      </div>

      <div className="text-sm text-ink-muted">
        {hover === 'outer' ? (
          <p>{copy.progressRingOuterHint(stats.totalTasks)}</p>
        ) : (
          <p>{copy.progressRingInnerHint(stats.doneTasks, stats.totalTasks, pct)}</p>
        )}
      </div>
    </div>
  );
}
