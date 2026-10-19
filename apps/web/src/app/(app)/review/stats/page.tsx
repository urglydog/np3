import { masteredRatio } from '@roadmap/core';
import { createClient } from '@/lib/supabase/server';
import { loadHomeStats, loadReviewAttempts } from '@/lib/review-data';
import { accuracyByQuestionType, groupAttemptsByDay, overallAccuracyPct } from '@/lib/review-stats';
import { BackLink } from '@/components/back-link';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

const CHART_W = 320;
const CHART_H = 120;
const PAD = 8;

/** Biểu đồ đường SVG thuần (không thêm lib chart) — % đúng theo ngày. */
function AccuracyChart({ points }: { points: { day: string; pct: number }[] }) {
  if (points.length === 0) {
    return <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-muted">{copy.reviewStatsChartEmpty}</p>;
  }
  const innerW = CHART_W - PAD * 2;
  const innerH = CHART_H - PAD * 2;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: PAD + i * stepX,
    y: PAD + innerH * (1 - p.pct / 100),
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-32 w-full" role="img" aria-label={copy.reviewStatsChartTitle}>
      <line x1={PAD} y1={CHART_H - PAD} x2={CHART_W - PAD} y2={CHART_H - PAD} stroke="var(--color-line)" strokeWidth="1" />
      <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={points[i]!.day} cx={c.x} cy={c.y} r="2.5" fill="var(--color-brand)">
          <title>{`${points[i]!.day}: ${points[i]!.pct}%`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default async function ReviewStatsPage() {
  const supabase = await createClient();
  const [home, attempts] = await Promise.all([loadHomeStats(supabase), loadReviewAttempts(supabase)]);
  const overallPct = overallAccuracyPct(attempts);
  const byType = accuracyByQuestionType(attempts);
  const byDay = groupAttemptsByDay(attempts);
  const masteredPct = Math.round(masteredRatio(home.overall.mastered, home.overall.total) * 100);

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-5 p-4 pb-24 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <BackLink label={copy.reviewBack} />
        <h1 className="text-2xl font-bold tracking-tight text-ink">{copy.reviewStatsTitle}</h1>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-brand/30 bg-brand/10 p-3">
          <span className="text-xs text-ink-muted">{copy.reviewStatsTotalQuestionsTitle}</span>
          <span className="text-2xl font-bold text-ink">{attempts.length}</span>
          <span className="text-[11px] text-ink-muted">{copy.reviewStatsTotalQuestionsHint}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-raised p-3">
          <span className="text-xs text-ink-muted">{copy.reviewStatsOverallAccuracy}</span>
          <span className="text-2xl font-bold text-ink">{overallPct}%</span>
          <span className="text-[11px] text-ink-muted">{copy.reviewStatsTotalAttempts(attempts.length)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-raised p-3">
          <span className="text-xs text-ink-muted">{copy.reviewStatsMasteredOverall}</span>
          <span className="text-2xl font-bold text-ink">{masteredPct}%</span>
          <span className="text-[11px] text-ink-muted">{copy.reviewOverallHint(home.overall.mastered, home.overall.total, home.overall.seen)}</span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewStatsByType}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {byType.map((t) => (
            <div key={t.questionType} className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface-raised p-3">
              <span className="text-xs text-ink-muted">{copy.reviewQuestionTypeLabel[t.questionType]}</span>
              {t.total === 0 ? (
                <span className="text-xs text-ink-faint">{copy.reviewStatsByTypeEmpty}</span>
              ) : (
                <>
                  <span className="text-lg font-bold text-ink">{t.pct}%</span>
                  <span className="text-[11px] text-ink-muted">{copy.reviewStatsAttemptsOn(t.total)}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewStatsChartTitle}</h2>
        <div className="rounded-xl border border-line bg-surface-raised p-3">
          <AccuracyChart points={byDay.map((d) => ({ day: d.day, pct: d.pct }))} />
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            {copy.reviewStatsChartLegend}
          </div>
        </div>
      </section>
    </main>
  );
}
