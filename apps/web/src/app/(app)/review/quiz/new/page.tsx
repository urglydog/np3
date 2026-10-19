import { redirect } from 'next/navigation';
import { loadQuizBuilderData, loadReviewListsWithItems } from '@/lib/review-data';
import { buildExampleCandidate, buildKanjiCandidate } from '@/lib/review-quiz-candidates';
import { QuizScopePicker } from '@/components/quiz-scope-picker';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

export default async function ReviewQuizNewPage() {
  const [data, lists] = await Promise.all([loadQuizBuilderData(), loadReviewListsWithItems()]);
  if (!data || lists === null) redirect('/login');

  const kanjiCandidates = data.kanji.map(buildKanjiCandidate).filter((c): c is NonNullable<typeof c> => c !== null);
  const exampleCandidates = data.examples.map(buildExampleCandidate).filter((c): c is NonNullable<typeof c> => c !== null);

  const lessonByItemId: Record<string, number[]> = {};
  for (const k of data.kanji) lessonByItemId[k.id] = [k.deckLesson];
  for (const e of data.examples) lessonByItemId[e.id] = e.lessons;

  const seededLessons = Array.from(new Set(data.kanji.map((k) => k.deckLesson))).sort((a, b) => a - b);

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 pb-24 md:p-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{copy.reviewQuizNewTitle}</h1>
      <QuizScopePicker
        kanjiCandidates={kanjiCandidates}
        exampleCandidates={exampleCandidates}
        lessonByItemId={lessonByItemId}
        seededLessons={seededLessons}
        lists={lists.map((l) => ({ id: l.id, name: l.name, items: l.items.map((it) => ({ itemType: it.itemType, itemId: it.itemId })) }))}
      />
    </main>
  );
}
