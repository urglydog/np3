import Link from 'next/link';
import { BookOpen, ChevronRight, Dumbbell, ListChecks, Lock } from 'lucide-react';
import { masteredRatio, TOTAL_BOOK_LESSONS } from '@roadmap/core';
import { createClient } from '@/lib/supabase/server';
import { loadHomeStats } from '@/lib/review-data';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

const R = 44;
const C = 2 * Math.PI * R;

export default async function ReviewHomePage() {
  const supabase = await createClient();
  const stats = await loadHomeStats(supabase);
  const byLesson = new Map(stats.lessons.map((l) => [l.lesson, l]));
  const ratio = masteredRatio(stats.overall.mastered, stats.overall.total);
  const pct = Math.round(ratio * 100);

  const entries = [
    { href: '/review/browse', icon: BookOpen, label: copy.reviewEntryBrowse, hint: copy.reviewEntryBrowseHint },
    { href: '/review/lists', icon: ListChecks, label: copy.reviewEntryLists, hint: copy.reviewEntryListsHint },
    { href: '/review/quiz/new', icon: Dumbbell, label: copy.reviewEntryPractice, hint: copy.reviewEntryPracticeHint },
  ];

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 pb-24 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-4">
        <h1 className="bg-gradient-to-r from-brand to-success bg-clip-text pb-1 text-3xl font-bold tracking-tight text-transparent">{copy.reviewTitle}</h1>
        <p className="text-sm text-ink-muted">{copy.reviewSubtitle}</p>
      </div>

      <section className="flex items-center gap-4 rounded-2xl border border-line bg-surface-raised p-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-line)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - ratio)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-ink">{pct}%</span>
            <span className="text-[10px] text-ink-muted">{copy.reviewMasteredPercent}</span>
          </div>
        </div>
        <p className="text-sm text-ink-muted">{copy.reviewOverallHint(stats.overall.mastered, stats.overall.total, stats.overall.seen)}</p>
      </section>

      <nav className="flex flex-col gap-2" aria-label={copy.reviewTitle}>
        {entries.map(({ href, icon: Icon, label, hint }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised p-4 transition-colors active:bg-brand/5"
          >
            <Icon className="h-6 w-6 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-ink">{label}</span>
              <span className="text-xs text-ink-muted">{hint}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-ink">{copy.reviewLessonsTitle}</h2>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: TOTAL_BOOK_LESSONS }, (_, i) => i + 1).map((lesson) => {
            const s = byLesson.get(lesson);
            if (!s) {
              return (
                <li
                  key={lesson}
                  className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line text-ink-faint"
                  title={copy.reviewLessonNoData}
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-xs font-semibold">{lesson}</span>
                  <span className="sr-only">{copy.reviewLessonNoData}</span>
                </li>
              );
            }
            const p = Math.round(masteredRatio(s.mastered, s.total) * 100);
            return (
              <li key={lesson}>
                <Link
                  href={`/review/browse?lesson=${lesson}`}
                  title={`${copy.reviewLessonLabel(lesson)}: ${p}% ${copy.reviewMasteredPercent}`}
                  className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-raised active:bg-brand/5"
                >
                  <span className="absolute inset-x-0 bottom-0 bg-success/15" style={{ height: `${p}%` }} aria-hidden="true" />
                  <span className="relative text-sm font-bold text-ink">{lesson}</span>
                  <span className="relative text-[10px] text-ink-muted">{p}%</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="flex flex-col gap-1 border-t border-line pt-4 text-xs text-ink-muted">
        {stats.overall.pending_kanji + stats.overall.pending_examples > 0 ? (
          <p>{copy.reviewPendingNote(stats.overall.pending_kanji, stats.overall.pending_examples)}</p>
        ) : null}
        <Link href="/review/stats" className="w-fit underline">
          {copy.reviewStatsLink}
        </Link>
        <Link href="/review/licenses" className="w-fit underline">
          {copy.reviewLicensesLink}
        </Link>
      </footer>
    </main>
  );
}
