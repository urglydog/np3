import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { loadQuizBatch, type QuizQuestion } from '@/lib/review-data';
import { parseQuizParams, scopeToParam } from '@/lib/review-scope';
import { QuizRunner } from '@/components/review/quiz-runner';
import { FlashMessage } from '@/components/review/flash-message';
import { toUserMessage } from '@/lib/errors';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

export default async function QuizPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parsed = parseQuizParams(await searchParams);

  // Tải dữ liệu trong try/catch, dựng JSX bên ngoài (lỗi render thuộc về error boundary, không phải catch này)
  let questions: QuizQuestion[] = [];
  let loadError: string | null = parsed.ok ? null : parsed.error;
  if (parsed.ok) {
    try {
      questions = await loadQuizBatch(await createClient(), parsed.value.scope, parsed.value.types, parsed.value.n);
    } catch (err) {
      loadError = toUserMessage(err);
    }
  }

  // Lỗi/rỗng: chưa có phiên nào để mất tiến độ → link quay lại tĩnh như cũ, không cần hỏi xác nhận.
  if (loadError || !parsed.ok || questions.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-screen-sm flex-col gap-4 p-4 pb-24 md:p-6">
        <Link href="/review/quiz/new" className="w-fit text-sm text-ink-muted">
          {copy.reviewBack}
        </Link>
        {loadError || !parsed.ok ? (
          <FlashMessage error={loadError ?? undefined} />
        ) : (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">{copy.reviewQuizEmpty}</p>
        )}
      </main>
    );
  }

  // Có đề: nút "Quay lại" chuyển vào bên trong QuizRunner (client component) để hỏi xác nhận khi đang có
  // tiến độ dở dang trong phiên — Server Component không bắt được sự kiện bấm.
  return (
    <main className="mx-auto flex w-full max-w-screen-sm flex-col gap-4 p-4 pb-24 md:p-6">
      {/* key: mỗi lần tải lại trang là một phiên mới */}
      <QuizRunner key={questions.map((q) => q.item_id + q.question_type).join()} questions={questions} scopeParam={scopeToParam(parsed.value.scope)} />
    </main>
  );
}
