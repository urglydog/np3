import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadKanjiDetail } from '@/lib/review-data';
import { ReviewDrawPracticeOpener } from '@/components/review-draw-practice-opener';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

function accuracyText(correct: number, total: number): string {
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  return copy.reviewDetailAccuracyLabel(correct, total, pct);
}

export default async function KanjiDetailPage({ params }: { params: Promise<{ hex: string }> }) {
  const { hex } = await params;
  const detail = await loadKanjiDetail(hex);
  if (detail === null) {
    // loadKanjiDetail trả null khi chưa đăng nhập hoặc không tìm thấy kanji. (app)/layout.tsx đã
    // chặn chưa đăng nhập ở tầng cao hơn (redirect /login trước khi vào route con), nên tới được
    // đây mà null nghĩa là không tìm thấy kanji theo unicode_hex này.
    notFound();
  }

  const { kanji, examples, k1State, k2State } = detail;

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      <Link href="/review/browse" className="text-sm text-brand">
        {copy.taskDetailBackLink}
      </Link>

      <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-raised p-6">
        <span className="text-7xl text-ink">{kanji.kanji}</span>
        <span className="text-lg font-semibold text-brand">{kanji.hanVietMain ?? '—'}</span>
        {kanji.meaningVi ? <span className="text-sm text-ink-muted">{kanji.meaningVi}</span> : null}
        {kanji.meaningEn ? <span className="text-xs text-ink-faint">{kanji.meaningEn}</span> : null}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-ink-muted">
          {kanji.onyomi.length > 0 ? <span>On: {kanji.onyomi.join('、')}</span> : null}
          {kanji.kunyomi.length > 0 ? <span>Kun: {kanji.kunyomi.join('、')}</span> : null}
          {kanji.strokeCount != null ? <span>{kanji.strokeCount} nét</span> : null}
        </div>
        {kanji.needsReview ? (
          <span className="mt-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">Đang chờ xác nhận</span>
        ) : null}
      </div>

      {/* Practice stats */}
      <section className="rounded-2xl border border-line bg-surface-raised p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">{copy.reviewDetailPracticeStatsTitle}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-ink-muted">{copy.reviewQuestionTypeK1}</p>
            <p className="text-ink">
              {k1State ? accuracyText(k1State.correctCount, k1State.correctCount + k1State.wrongCount) : copy.reviewDetailNoAttemptYet}
            </p>
          </div>
          <div>
            <p className="text-ink-muted">{copy.reviewQuestionTypeK2}</p>
            <p className="text-ink">
              {k2State ? accuracyText(k2State.correctCount, k2State.correctCount + k2State.wrongCount) : copy.reviewDetailNoAttemptYet}
            </p>
          </div>
        </div>
      </section>

      {/* Thứ tự nét */}
      <section className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-raised p-4">
        <h2 className="self-start text-sm font-semibold text-ink-muted">{copy.reviewDetailStrokeOrderTitle}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh do app tự host, không phải nội dung người dùng/LLM sinh */}
        <img src={kanji.svgPath} alt={`Thứ tự nét ${kanji.kanji}`} loading="lazy" className="h-40 w-40" />
        <p className="text-[11px] text-ink-faint">
          {copy.reviewKanjivgCredit} ·{' '}
          <Link href="/review/licenses" className="underline">
            {copy.reviewLicensesLink}
          </Link>
        </p>
        <ReviewDrawPracticeOpener strokePoints={kanji.strokePoints} />
      </section>

      {/* Ví dụ */}
      <section className="rounded-2xl border border-line bg-surface-raised p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">{copy.reviewDetailExamplesTitle}</h2>
        {examples.length === 0 ? (
          <p className="text-sm text-ink-faint">{copy.reviewDetailNoExamples}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {examples.map((ex) => (
              <li key={ex.id} className="flex flex-col gap-0.5 rounded-lg bg-surface px-3 py-2">
                <span className="text-ink">
                  {ex.term} <span className="text-ink-muted">（{ex.readingKana}）</span>
                </span>
                {ex.meaningVi ? <span className="text-xs text-ink-muted">{ex.meaningVi}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
