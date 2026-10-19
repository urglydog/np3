import { redirect } from 'next/navigation';
import Link from 'next/link';
import { loadKanjiByLesson, loadReviewLists } from '@/lib/review-data';
import { ReviewSelectToolbar } from '@/components/review-select-toolbar';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

const MAX_SEEDED_LESSON = 12; // chỉ bài 1-12 đã seed (M1b) — ngoài phạm vi này chưa có dữ liệu

export default async function ReviewBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson: lessonParam } = await searchParams;
  const lesson = Math.max(1, Number.parseInt(lessonParam ?? '1', 10) || 1);

  const lists = await loadReviewLists();
  if (lists === null) redirect('/login');

  const notSeeded = lesson > MAX_SEEDED_LESSON;
  const kanjiRows = notSeeded ? [] : await loadKanjiByLesson(lesson);

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{copy.reviewBrowseTitle}</h1>
        <p className="text-sm text-ink-muted">{copy.reviewLessonLabel(lesson)}</p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link href={`/review/browse?lesson=${Math.max(1, lesson - 1)}`} className="text-brand">
          {copy.reviewBrowsePrevLesson}
        </Link>
        <Link href={`/review/browse?lesson=${lesson + 1}`} className="text-brand">
          {copy.reviewBrowseNextLesson}
        </Link>
      </div>

      {notSeeded || !kanjiRows || kanjiRows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface-raised p-4 text-sm text-ink-muted">
          {copy.reviewBrowseLessonNotSeeded}
        </p>
      ) : (
        <ReviewSelectToolbar
          tiles={kanjiRows.map((k) => ({ hex: k.unicodeHex, id: k.id, kanji: k.kanji, hanVietMain: k.hanVietMain }))}
          lists={lists}
        />
      )}
    </main>
  );
}
