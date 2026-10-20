import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { loadLists, loadScopeCandidates } from '@/lib/review-data';
import { countByType, MAX_QUIZ_QUESTIONS, parseScope, scopeToParam, type ReviewScope } from '@/lib/review-scope';
import { QuizSetupForm } from '@/components/review/quiz-setup-form';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

function scopeTitle(scope: ReviewScope, listNames: string[]): string {
  switch (scope.kind) {
    case 'lesson':
      return copy.reviewQuizScopeLabel.lesson(scope.lesson);
    case 'kanji':
      return copy.reviewQuizScopeLabel.kanji(scope.hexes.length);
    case 'list':
      return listNames.length === 1 ? listNames[0]! : listNames.length > 1 ? copy.reviewQuizScopeLabel.lists(listNames.length) : copy.reviewQuizScopeLists;
    case 'smart':
      return copy.reviewSmartLabel[scope.strategy];
  }
}

const chip = 'flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-raised px-3 py-3 text-sm text-ink active:bg-brand/5';

export default async function QuizNewPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope: rawScope } = await searchParams;
  const scope = parseScope(rawScope);
  const supabase = await createClient();

  if (!scope) {
    // Chọn phạm vi (theo bài/theo chữ/theo danh sách) đã dời sang /review/practice — trang này chỉ còn
    // nhận scope đã có sẵn và xử lý bước chọn loại câu + số câu (CLAUDE.md phản hồi #4/#6).
    return (
      <main className="mx-auto flex w-full max-w-screen-md flex-col gap-5 p-4 pb-24 md:p-6">
        <div className="flex flex-col gap-1 border-b border-line pb-3">
          <Link href="/review" className="w-fit text-sm text-ink-muted">
            {copy.reviewBack}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{copy.reviewQuizNewTitle}</h1>
        </div>
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">{copy.reviewQuizChooseScope}</p>
        <Link href="/review/practice" className={`${chip} justify-center font-semibold`}>
          {copy.reviewPracticeTitle}
        </Link>
      </main>
    );
  }

  const [candidates, lists] = await Promise.all([loadScopeCandidates(supabase, scope), scope.kind === 'list' ? loadLists(supabase) : Promise.resolve([])]);
  const counts = countByType(candidates);
  const listNames = scope.kind === 'list' ? lists.filter((l) => scope.listIds.includes(l.id)).map((l) => l.name) : [];
  const total = counts.K1 + counts.E1 + counts.K2 + counts.E2;

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-5 p-4 pb-24 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <Link href="/review/quiz/new" className="w-fit text-sm text-ink-muted">
          {copy.reviewQuizChangeScope}
        </Link>
        <h1 className="break-words text-2xl font-bold tracking-tight text-ink">{scopeTitle(scope, listNames)}</h1>
      </div>
      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">{copy.reviewQuizNothing}</p>
      ) : (
        <QuizSetupForm scopeParam={scopeToParam(scope)} counts={counts} maxCap={MAX_QUIZ_QUESTIONS} />
      )}
    </main>
  );
}
