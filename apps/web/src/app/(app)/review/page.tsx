import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Dumbbell, BarChart3, ListChecks } from 'lucide-react';
import { masteredRatio, TOTAL_BOOK_LESSONS, type CardState } from '@roadmap/core';
import { loadReviewHomeData } from '@/lib/review-data';
import { masteryBreakdown, buildLessonGrid, MASTERY_LEVEL_ORDER } from '@/lib/review-stats';
import { ReviewMasteryRing } from '@/components/review-mastery-ring';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

const MASTERY_LABEL: Record<(typeof MASTERY_LEVEL_ORDER)[number], string> = {
  mastered: copy.reviewMasteryLevelMastered,
  good: copy.reviewMasteryLevelGood,
  to_confirm: copy.reviewMasteryLevelToConfirm,
  bad: copy.reviewMasteryLevelBad,
  new: copy.reviewMasteryLevelNew,
};

// Map 5 mức mastery -> token màu có sẵn trong globals.css (KHÔNG literal color).
const MASTERY_BAR_CLASS: Record<(typeof MASTERY_LEVEL_ORDER)[number], string> = {
  mastered: 'bg-success',
  good: 'bg-brand',
  to_confirm: 'bg-warning',
  bad: 'bg-danger',
  new: 'bg-ink-faint',
};

export default async function ReviewHomePage() {
  const data = await loadReviewHomeData();
  if (!data) redirect('/login');

  const allStates: CardState[] = data.cardStates.map((c) => c.state);
  const overallPct = Math.round(masteredRatio(allStates) * 100);
  const breakdown = masteryBreakdown(allStates.map((s) => s.masteryLevel));
  const maxBreakdownCount = Math.max(1, ...breakdown.map((b) => b.count));

  const statesByLesson = new Map<number, CardState[]>();
  for (const row of data.cardStates) {
    if (row.itemType !== 'kanji') continue;
    const lesson = data.kanjiLessonById.get(row.itemId);
    if (lesson == null) continue;
    const arr = statesByLesson.get(lesson) ?? [];
    arr.push(row.state);
    statesByLesson.set(lesson, arr);
  }
  const seededLessons = new Set(data.kanjiLessonById.values());
  const ratioByLesson = new Map<number, number>();
  for (const [lesson, states] of statesByLesson) ratioByLesson.set(lesson, masteredRatio(states));
  const lessonGrid = buildLessonGrid(TOTAL_BOOK_LESSONS, seededLessons, ratioByLesson);

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <h1 className="pb-1 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand to-success">
          {copy.reviewHomeTitle}
        </h1>
      </div>

      {/* Vòng % tổng + breakdown 5 mức mastery */}
      <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <ReviewMasteryRing pct={overallPct} />
          <div className="w-full text-sm text-ink-muted">
            <p className="mb-3">{copy.reviewOverallHint(overallPct)}</p>
            <div className="flex flex-col gap-1.5">
              {breakdown.map((row) => (
                <div key={row.level} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-ink-muted">{MASTERY_LABEL[row.level]}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full ${MASTERY_BAR_CLASS[row.level]}`}
                      style={{ width: `${Math.round((row.count / maxBreakdownCount) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs text-ink">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2 nút lớn */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/review/browse" className="btn-primary flex-col py-4">
          <BookOpen className="h-5 w-5" />
          {copy.reviewBrowseButton}
        </Link>
        <Link href="/review/quiz/new" className="btn-primary flex-col py-4">
          <Dumbbell className="h-5 w-5" />
          {copy.reviewQuizButton}
        </Link>
      </div>

      <div className="flex items-center justify-center gap-4 text-sm">
        <Link href="/review/stats" className="flex items-center gap-1 text-ink-muted hover:text-ink">
          <BarChart3 className="h-4 w-4" />
          {copy.reviewStatsLink}
        </Link>
        <Link href="/review/lists" className="flex items-center gap-1 text-ink-muted hover:text-ink">
          <ListChecks className="h-4 w-4" />
          {copy.reviewListsLink}
        </Link>
      </div>

      {/* Lưới 32 ô bài */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-muted">{copy.reviewLessonsGridTitle}</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {lessonGrid.map((cell) =>
            cell.hasData ? (
              <Link
                key={cell.lesson}
                href={`/review/browse?lesson=${cell.lesson}`}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-raised p-2 aspect-square"
                title={copy.reviewLessonLabel(cell.lesson)}
              >
                <span className="text-xs font-medium text-ink">{cell.lesson}</span>
                <span className="text-[10px] text-ink-muted">{cell.masteredPct}%</span>
              </Link>
            ) : (
              <div
                key={cell.lesson}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface p-2 aspect-square opacity-40"
                title={copy.reviewLessonNoDataLabel}
              >
                <span className="text-xs font-medium text-ink-faint">{cell.lesson}</span>
                <span className="text-[9px] text-ink-faint">{copy.reviewLessonNoDataLabel}</span>
              </div>
            ),
          )}
        </div>
      </section>

      <p className="mt-2 text-center text-xs text-ink-faint">
        <Link href="/review/licenses" className="underline">
          {copy.reviewLicensesLink}
        </Link>
      </p>
    </main>
  );
}
