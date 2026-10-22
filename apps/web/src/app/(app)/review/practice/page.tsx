import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loadAllLessonsKanji, loadLists } from '@/lib/review-data';
import { LessonKanjiPicker } from '@/components/review/lesson-kanji-picker';
import { ListsMultiSelect } from '@/components/review/lists-multi-select';
import { FlashMessage } from '@/components/review/flash-message';
import { SubmitButton } from '@/components/submit-button';
import { createListAction } from '../actions';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

/**
 * Hợp nhất Duyệt kanji + Danh sách cũ: chọn chữ theo bài (cả bài hoặc từng chữ, nhiều bài cùng lúc) hoặc
 * theo danh sách đã tạo, rồi luyện ngay hoặc lưu thành danh sách — không còn phải tạo list con cho mỗi
 * bài rồi gộp lại (CLAUDE.md phản hồi #4/#6).
 */
export default async function ReviewPracticePage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string; ok?: string; error?: string }>;
}) {
  const { lesson: rawLesson, ok, error } = await searchParams;
  const supabase = await createClient();
  const [lessons, lists] = await Promise.all([loadAllLessonsKanji(supabase), loadLists(supabase)]);
  const requestedLesson = Number(rawLesson);
  const initialLesson = lessons.some((g) => g.lesson === requestedLesson) ? requestedLesson : undefined;

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-5 p-4 pb-24 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <Link href="/review" className="w-fit text-sm text-ink-muted">
          {copy.reviewBack}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{copy.reviewPracticeTitle}</h1>
      </div>

      <FlashMessage ok={ok} error={error} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewPracticeListsSection}</h2>
        <form action={createListAction} className="flex gap-2">
          <input
            name="name"
            required
            maxLength={100}
            placeholder={copy.reviewListNamePlaceholder}
            aria-label={copy.reviewListNameLabel}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-raised px-3 py-2 text-base text-ink"
          />
          <SubmitButton className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-hover">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {copy.reviewListCreate}
          </SubmitButton>
        </form>
        {lists.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-muted">{copy.reviewListsEmpty}</p>
        ) : (
          <ListsMultiSelect lists={lists} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewPracticeLessonsSection}</h2>
        {lessons.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-muted">{copy.reviewLessonNoData}</p>
        ) : (
          <LessonKanjiPicker
            lessons={lessons}
            lists={lists.map((l) => ({ id: l.id, name: l.name }))}
            returnTo="/review/practice"
            initialLesson={initialLesson}
          />
        )}
      </section>
    </main>
  );
}
