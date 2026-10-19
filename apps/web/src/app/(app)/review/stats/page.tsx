import { redirect } from 'next/navigation';
import { masteredRatio, type CardState } from '@roadmap/core';
import { loadReviewStatsData } from '@/lib/review-data';
import { groupAttemptsByDay, accuracyByQuestionType, overallAccuracyPct } from '@/lib/review-stats';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

const QUESTION_TYPE_LABEL = {
  K1: copy.reviewQuestionTypeK1,
  E1: copy.reviewQuestionTypeE1,
  K2: copy.reviewQuestionTypeK2,
  E2: copy.reviewQuestionTypeE2,
} as const;

// Polyline SVG thuần, cùng convention vẽ % với progress-rings.tsx (không thêm thư viện chart).
function EvolutionChart({ points }: { points: { date: string; accuracyPct: number }[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">{copy.reviewStatsEmptyState}</p>;
  }
  const width = 320;
  const height = 120;
  const padding = 8;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = padding + innerH * (1 - p.accuracyPct / 100);
    return { x, y };
  });
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-line)" strokeWidth={1} />
      <polyline points={polylinePoints} fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={2.5} fill="var(--color-success)" />
      ))}
    </svg>
  );
}

export default async function ReviewStatsPage() {
  const data = await loadReviewStatsData();
  if (!data) redirect('/login');

  const allStates: CardState[] = data.cardStates.map((c) => c.state);
  const overallPct = Math.round(masteredRatio(allStates) * 100);
  const totalAttempts = data.attempts.length;
  const overallAccuracy = overallAccuracyPct(data.attempts);
  const byType = accuracyByQuestionType(data.attempts);
  const byDay = groupAttemptsByDay(data.attempts);

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{copy.reviewStatsTitle}</h1>
      </div>

      {/* Thẻ tổng quan */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface-raised p-4 text-center">
          <p className="text-2xl font-bold text-brand">{overallPct}%</p>
          <p className="text-xs text-ink-muted">{copy.reviewStatsOverallLabel}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-raised p-4 text-center">
          <p className="text-2xl font-bold text-ink">{totalAttempts}</p>
          <p className="text-xs text-ink-muted">{copy.reviewStatsTotalAttemptsLabel(totalAttempts)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-raised p-4 text-center">
          <p className="text-2xl font-bold text-success">{overallAccuracy}%</p>
          <p className="text-xs text-ink-muted">{copy.reviewStatsOverallAccuracyLabel}</p>
        </div>
      </section>

      {/* Accuracy theo loại câu hỏi */}
      <section className="rounded-2xl border border-line bg-surface-raised p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">{copy.reviewStatsAccuracyByTypeTitle}</h2>
        <div className="flex flex-col gap-2">
          {byType.map((row) => (
            <div key={row.questionType} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink">{QUESTION_TYPE_LABEL[row.questionType]}</span>
              <span className="text-ink-muted">{copy.reviewStatsAccuracyCell(row.correct, row.total, row.accuracyPct)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Mastery evolution theo thời gian */}
      <section className="rounded-2xl border border-line bg-surface-raised p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">{copy.reviewStatsEvolutionTitle}</h2>
        <EvolutionChart points={byDay} />
      </section>
    </main>
  );
}
