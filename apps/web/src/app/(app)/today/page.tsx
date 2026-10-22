import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { currentTaskId, masteredRatio } from '@roadmap/core';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { buildPhraseMatrix } from '@/lib/roadmap';
import { copy } from '@/lib/copy';
import { createClient } from '@/lib/supabase/server';
import { loadHomeStats, loadReadWriteStats } from '@/lib/review-data';
import { PhraseMatrix } from '@/components/phrase-matrix';
import { TodayCarousel, type CarouselTask } from '@/components/today-carousel';

export const dynamic = 'force-dynamic';

const WINDOW = 3; // số task trước/sau task hiện tại hiện trong carousel

// Vòng tròn % tổng — bán kính nhỏ hơn bản ở /review vì đây chỉ là khối tóm tắt.
const REVIEW_RING_R = 40;
const REVIEW_RING_C = 2 * Math.PI * REVIEW_RING_R;

interface TodayReviewSummary {
  overall: { total: number; mastered: number };
  k1: { mastered: number; total: number };
  k2: { mastered: number; total: number };
}

/**
 * Tải tóm tắt module Ôn luyện cho khối nhỏ trên /today. Bọc try/catch riêng: nếu module Ôn luyện có vấn đề
 * (lỗi DB, RPC...), trang /today — màn quan trọng nhất của app — vẫn phải hiển thị đầy đủ phần lộ trình,
 * chỉ ẩn khối này đi (CLAUDE.md #2 "không ảnh hưởng chức năng đang hoạt động tốt").
 */
async function loadTodayReviewSummary(supabase: SupabaseClient): Promise<TodayReviewSummary | null> {
  try {
    const [stats, readWrite] = await Promise.all([loadHomeStats(supabase), loadReadWriteStats(supabase)]);
    return { overall: stats.overall, k1: readWrite.k1, k2: readWrite.k2 };
  } catch (err) {
    console.error('Không tải được tóm tắt Ôn luyện cho /today:', err);
    return null;
  }
}

export default async function TodayPage() {
  const supabase = await createClient();
  const [plan, reviewSummary] = await Promise.all([loadCurrentPlanSchedule(), loadTodayReviewSummary(supabase)]);
  if (!plan) redirect('/create-plan');

  const { schedule, taskInfoById } = plan;
  const currentId = currentTaskId(schedule.tasks);
  const activeTasks = schedule.tasks.filter((t) => t.status !== 'skipped');
  const currentIdx = currentId ? activeTasks.findIndex((t) => t.id === currentId) : -1;

  const windowStart = currentIdx < 0 ? 0 : Math.max(0, currentIdx - WINDOW);
  const windowEnd = currentIdx < 0 ? 0 : Math.min(activeTasks.length, currentIdx + WINDOW + 1);
  const carouselTasks: CarouselTask[] = activeTasks.slice(windowStart, windowEnd).map((t) => ({
    id: t.id,
    name: taskInfoById.get(t.id)?.name ?? t.id,
    milestone: taskInfoById.get(t.id)?.milestone ?? null,
    due: t.due,
    status: t.status,
    isCurrent: t.id === currentId,
  }));
  const carouselStartIndex = currentIdx < 0 ? 0 : currentIdx - windowStart;
  const phraseGroups = buildPhraseMatrix(schedule.tasks, taskInfoById);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 p-4 py-10">
      <div className="flex flex-col items-center text-center gap-2">
        {/* pb-2 prevents gradient text bottom clip */}
        <h1 className="pb-2 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand to-success">
          {copy.todayTitle}
        </h1>
        {schedule.finish ? <p className="text-sm font-medium text-ink-muted">{copy.todayFinishLabel(schedule.finish)}</p> : null}
        {schedule.requiredHoursPerDayFor365 != null ? (
          <p className="text-sm font-medium text-warning drop-shadow-sm">{copy.todayRequiredHoursLabel(schedule.requiredHoursPerDayFor365)}</p>
        ) : null}
      </div>

      {carouselTasks.length > 0 ? (
        <TodayCarousel tasks={carouselTasks} startIndex={carouselStartIndex} />
      ) : (
        <div className="glass flex w-full flex-col items-center justify-center gap-4 rounded-2xl p-10 text-center shadow-xl">
          <div className="rounded-full bg-success/20 p-4">
            <svg className="w-12 h-12 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-ink">Hoàn thành xuất sắc!</h2>
          <p className="text-sm text-ink-muted">{copy.todayEmptyState}</p>
        </div>
      )}

      <p className="text-xs text-ink-faint">{copy.hoursEstimateDisclaimer}</p>

      {phraseGroups.length > 0 ? (
        <details className="group w-full">
          <summary className="cursor-pointer select-none list-none text-center text-sm font-medium text-ink-muted hover:text-ink">
            {copy.todayPhraseMatrixTitle}
          </summary>
          <div className="mt-4">
            <PhraseMatrix groups={phraseGroups} />
          </div>
        </details>
      ) : null}

      {reviewSummary ? (
        <section className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{copy.todayReviewTitle}</h2>
            {reviewSummary.overall.total > 0 ? (
              <Link href="/review" className="text-xs font-medium text-brand underline">
                {copy.todayReviewViewDetail}
              </Link>
            ) : null}
          </div>

          {reviewSummary.overall.total > 0 ? (
            (() => {
              const ratio = masteredRatio(reviewSummary.overall.mastered, reviewSummary.overall.total);
              const pct = Math.round(ratio * 100);
              const k1Pct = Math.round(masteredRatio(reviewSummary.k1.mastered, reviewSummary.k1.total) * 100);
              const k2Pct = Math.round(masteredRatio(reviewSummary.k2.mastered, reviewSummary.k2.total) * 100);
              return (
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                      <circle cx="50" cy="50" r={REVIEW_RING_R} fill="none" stroke="var(--color-line)" strokeWidth="10" />
                      <circle
                        cx="50"
                        cy="50"
                        r={REVIEW_RING_R}
                        fill="none"
                        stroke="var(--color-success)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={REVIEW_RING_C}
                        strokeDashoffset={REVIEW_RING_C * (1 - ratio)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-ink">{pct}%</span>
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-brand">{copy.reviewReadWriteK1Label}</span>
                      <span className="text-ink">{k1Pct}%</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-success">{copy.reviewReadWriteK2Label}</span>
                      <span className="text-ink">{k2Pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-sm text-ink-muted">{copy.todayReviewEmptyState}</p>
              <Link
                href="/review/quiz/new"
                className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white active:opacity-80"
              >
                {copy.todayReviewStart}
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
