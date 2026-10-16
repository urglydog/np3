import Link from 'next/link';
import { Dumbbell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loadLessonKanji, loadLists, loadLoadedLessons } from '@/lib/review-data';
import { KanjiPicker } from '@/components/review/kanji-picker';
import { FlashMessage } from '@/components/review/flash-message';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

export default async function ReviewBrowsePage({ searchParams }: { searchParams: Promise<{ lesson?: string; ok?: string; error?: string }> }) {
  const { lesson: rawLesson, ok, error } = await searchParams;
  const supabase = await createClient();
  const [lessons, lists] = await Promise.all([loadLoadedLessons(supabase), loadLists(supabase)]);
  const requested = Number(rawLesson);
  const lesson = lessons.includes(requested) ? requested : (lessons[0] ?? 1);
  const kanji = await loadLessonKanji(supabase, lesson);

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-4 p-4 pb-24 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <Link href="/review" className="w-fit text-sm text-ink-muted">
          {copy.reviewBack}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{copy.reviewBrowseTitle}</h1>
      </div>

      <FlashMessage ok={ok} error={error} />

      {/* Chọn bài: cuộn ngang trên điện thoại */}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={copy.reviewLessonsTitle}>
        {lessons.map((l) => (
          <Link
            key={l}
            href={`/review/browse?lesson=${l}`}
            aria-current={l === lesson ? 'page' : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
              l === lesson ? 'border-brand bg-brand/10 text-brand' : 'border-line text-ink-muted'
            }`}
          >
            {copy.reviewLessonLabel(l)}
          </Link>
        ))}
      </nav>

      <Link
        href={`/review/quiz/new?scope=lesson:${lesson}`}
        className="flex w-fit items-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand"
      >
        <Dumbbell className="h-4 w-4" aria-hidden="true" />
        {copy.reviewBrowsePracticeLesson(lesson)}
      </Link>

      <KanjiPicker
        items={kanji.map((k) => ({ hex: k.unicode_hex, kanji: k.kanji, hanViet: k.han_viet_main, pending: !k.confirmed_at }))}
        lists={lists.map((l) => ({ id: l.id, name: l.name }))}
        returnTo={`/review/browse?lesson=${lesson}`}
      />
    </main>
  );
}
