'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eraser, Loader2, Pencil, Send, XCircle } from 'lucide-react';
import { scoreHandwriting, type HandwritingScore, type QuestionType, type StrokePath } from '@roadmap/core';
import { revealAnswerAction, strokeReferenceAction, submitAnswerAction } from '@/app/(app)/review/actions';
import { HandwritingCanvas, type HandwritingCanvasHandle, type NormalizedPoint } from './handwriting-canvas';
import type { QuizQuestion } from '@/lib/review-data';
import type { RevealResult, SubmitAnswerResult } from '@/lib/review-mutations';
import { newClientId } from '@/lib/client-id';
import { copy } from '@/lib/copy';

const DONT_KNOW = '(không biết)'; // luôn chấm sai ở cả TS lẫn SQL, vẫn lưu nguyên văn vào attempt_log

interface Answered {
  q: QuizQuestion;
  result: SubmitAnswerResult;
  given: string | null;
}

function promptLabel(q: QuizQuestion): string {
  switch (q.question_type) {
    case 'K1':
      return q.prompt.kanji ?? '';
    case 'E1':
    case 'E2':
      return q.prompt.meaning_vi ?? '';
    case 'K2':
      return `${q.prompt.han_viet_main ?? ''}${q.prompt.meaning_vi ? ` — ${q.prompt.meaning_vi}` : ''}`;
  }
}

function answerSummary(a: Answered): string {
  const r = a.result.answer;
  return a.q.item_type === 'kanji'
    ? `${r.kanji ?? ''} · ${r.han_viet_main ?? ''}`
    : `${r.term ?? ''} (${r.reading_kana ?? ''})${r.han_viet ? ` · ${r.han_viet}` : ''}`;
}

export function QuizRunner({ questions, scopeParam }: { questions: QuizQuestion[]; scopeParam: string }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [attemptId, setAttemptId] = useState(() => newClientId());
  const [input, setInput] = useState('');
  const [composing, setComposing] = useState(false);
  const [result, setResult] = useState<SubmitAnswerResult | null>(null);
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [strokes, setStrokes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [finished, setFinished] = useState(false);
  const [pending, startTransition] = useTransition();
  const canvas = useRef<HandwritingCanvasHandle>(null);

  // ---- Tự chấm K2 (CLAUDE.md #4c): heuristic hình học client-side, chỉ tự đánh dấu ĐÚNG khi rất chắc.
  // reference null = chưa seed stroke_points cho kanji này → luôn rơi về luồng reveal + tự xác nhận cũ.
  const [strokeReference, setStrokeReference] = useState<StrokePath[] | null>(null);
  const [drawnStrokes, setDrawnStrokes] = useState<NormalizedPoint[][]>([]);
  const [manualOverride, setManualOverride] = useState(false);
  // K2 (Việc 2): chỉ chấm sau khi bấm "Nộp bài", không chấm liên tục khi đang vẽ — score đóng băng tại lúc
  // bấm nộp (không tính lại theo drawnStrokes sống) để không đổi kết quả nếu người dùng vẽ thêm sau đó.
  const [submitted, setSubmitted] = useState(false);
  const [frozenAutoScore, setFrozenAutoScore] = useState<HandwritingScore | null>(null);
  // Trắc nghiệm ví dụ (E1): từ đã bấm chọn, để tô màu đúng/sai sau khi có kết quả.
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const q = questions[idx];

  // Đổi câu (item_id/question_type đổi) → reset toạ độ nét tham chiếu NGAY trong lúc render
  // (mẫu "adjusting state during rendering" của React), không setState đồng bộ trong effect body
  // để tránh cascading render (react-hooks/set-state-in-effect).
  const strokeReferenceKey = q ? `${q.item_id}:${q.question_type}` : null;
  const strokeReferenceKeyRef = useRef<string | null>(null);
  if (strokeReferenceKeyRef.current !== strokeReferenceKey) {
    strokeReferenceKeyRef.current = strokeReferenceKey;
    if (strokeReference !== null) setStrokeReference(null);
  }

  useEffect(() => {
    if (!q || q.question_type !== 'K2') return;
    let cancelled = false;
    strokeReferenceAction(q.item_id).then((res) => {
      if (!cancelled && res.ok) setStrokeReference((res.data as StrokePath[] | null) ?? null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ phụ thuộc câu hiện tại, không phải cả object q
  }, [q?.item_id, q?.question_type]);

  // Dùng chung cho nút "Câu tiếp" bấm thủ công VÀ tự động nhảy câu khi trả lời đúng (Việc 3) — phải reset
  // y hệt mọi state của câu cũ trước khi sang câu mới, không phân biệt K1/E1/K2. Định nghĩa trước early
  // return `if (!q) return null` để hook useEffect bên dưới (phụ thuộc goNext) không vi phạm rules-of-hooks.
  const goNext = () => {
    if (idx + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIdx(idx + 1);
    setAttemptId(newClientId());
    setInput('');
    setResult(null);
    setReveal(null);
    setStrokes(0);
    setError(null);
    setDrawnStrokes([]);
    setManualOverride(false);
    setSubmitted(false);
    setFrozenAutoScore(null);
    setSelectedChoice(null);
    canvas.current?.clear();
  };

  // Trả lời ĐÚNG → tự động nhảy câu tiếp sau một khoảng trễ ngắn để người dùng kịp thấy kết quả, không cần
  // tự bấm "Câu tiếp". Trả lời SAI vẫn phải tự bấm (để có thời gian đọc đáp án đúng) — xem CLAUDE.md Việc 3.
  // Áp dụng cho cả K1/E1 (result có ngay sau submit) lẫn K2 (result chỉ có sau khi người dùng tự đánh giá
  // hoặc giữ kết quả auto-grade) vì cả hai đều đi qua cùng state `result`.
  useEffect(() => {
    if (!result || !result.is_correct) return;
    const t = setTimeout(goNext, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goNext đọc idx/questions mới nhất qua closure mỗi render, không cần liệt kê
  }, [result, idx]);

  const handleExit = () => {
    if (answered.length > 0 && !finished && !window.confirm(copy.reviewQuizExitConfirm)) return;
    router.push(`/review/quiz/new?scope=${encodeURIComponent(scopeParam)}`);
  };

  if (!q) return null;

  // Banner "Tự chấm ĐÚNG" chỉ được xét SAU khi đã bấm "Nộp bài" (submitted), dùng frozenAutoScore (đóng
  // băng tại lúc nộp), không phải tính sống theo drawnStrokes — tránh hiện banner giữa chừng khi đang vẽ.
  const autoSuggested = submitted && !manualOverride && !!frozenAutoScore?.autoCorrect;

  const submit = (answerText: string | null, selfCorrect: boolean | null, autoGraded = false) => {
    setError(null);
    startTransition(async () => {
      // cùng attemptId cho mọi lần thử lại của câu này → server không tính hai lần
      const res = await submitAnswerAction({
        itemType: q.item_type,
        itemId: q.item_id,
        questionType: q.question_type,
        answerText,
        selfCorrect,
        clientAttemptId: attemptId,
        autoGraded,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
      setAnswered((xs) => [...xs, { q, result: res.data, given: answerText }]);
    });
  };

  const doReveal = () => {
    setError(null);
    startTransition(async () => {
      const res = await revealAnswerAction(q.item_id);
      if (!res.ok) setError(res.error);
      else setReveal(res.data);
    });
  };

  if (finished) {
    const correct = answered.filter((a) => a.result.is_correct).length;
    const wrong = answered.filter((a) => !a.result.is_correct);
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-ink">{copy.reviewQuizResultTitle}</h2>
        <p className="text-lg text-ink">{copy.reviewQuizResultScore(correct, answered.length)}</p>
        {wrong.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">{copy.reviewQuizResultWrongList}</h3>
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface-raised">
              {wrong.map((a, i) => (
                <li key={i} className="flex flex-col px-3 py-2 text-sm">
                  <span className="text-xs text-ink-muted">{copy.reviewQuestionTypeLabel[a.q.question_type]}</span>
                  <span className="text-ink" lang="ja">
                    {answerSummary(a)}
                  </span>
                  {a.given && a.given !== DONT_KNOW ? <span className="text-xs text-danger">{copy.reviewQuizYourAnswer(a.given)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/review/quiz/new?scope=${encodeURIComponent(scopeParam)}`}
            className="rounded-xl bg-brand px-4 py-3 text-center font-semibold text-white"
          >
            {copy.reviewQuizAgain}
          </Link>
          <Link href="/review" className="rounded-xl border border-line px-4 py-3 text-center text-ink">
            {copy.reviewQuizBackHome}
          </Link>
        </div>
      </section>
    );
  }

  // Việc 1: E1 cho item_type='example' là trắc nghiệm (bấm = nộp luôn), không còn gõ tự do.
  const isExampleMC = q.question_type === 'E1' && q.item_type === 'example';
  const typed = q.question_type !== 'K2' && !isExampleMC;
  const isLast = idx + 1 >= questions.length;

  return (
    <section className="flex flex-col gap-4">
      <button type="button" onClick={handleExit} className="w-fit text-sm text-ink-muted">
        {copy.reviewBack}
      </button>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>{copy.reviewQuizProgress(idx + 1, questions.length)}</span>
          <span>{copy.reviewQuestionTypeLabel[q.question_type]}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full bg-brand transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} />
        </div>
      </div>

      <p className="text-xs text-ink-muted">{copy.reviewQuestionTypeHint[q.question_type]}</p>

      {/* Đề — thu nhỏ để chừa chỗ cho khung trả lời (trắc nghiệm/viết tay) */}
      <div className="flex min-h-[5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-center">
        {q.question_type === 'K1' ? (
          <span className="text-6xl leading-tight text-ink" lang="ja">
            {promptLabel(q)}
          </span>
        ) : q.question_type === 'E1' || q.question_type === 'E2' ? (
          <span className="text-xl font-semibold text-ink">{promptLabel(q)}</span>
        ) : (
          <>
            <span className="text-3xl font-bold text-ink">{q.prompt.han_viet_main}</span>
            {q.prompt.meaning_vi ? <span className="text-base text-ink">{q.prompt.meaning_vi}</span> : null}
            {q.prompt.meaning_en ? <span className="text-xs text-ink-muted">{q.prompt.meaning_en}</span> : null}
            {q.prompt.stroke_count ? <span className="text-xs text-ink-muted">{copy.reviewQuizStrokeHint(q.prompt.stroke_count)}</span> : null}
          </>
        )}
      </div>

      {/* Trả lời */}
      {isExampleMC ? (
        <div className="grid grid-cols-2 gap-2">
          {(() => {
            // eslint-disable-next-line no-console -- debug tạm, xoá sau khi tìm ra nguyên nhân lỗi choices rỗng
            console.log('[QuizRunner debug] q.prompt.choices =', q.prompt.choices, 'q =', q);
            return null;
          })()}
          {(q.prompt.choices ?? []).map((choice) => {
            const isChosen = selectedChoice === choice;
            // Chỉ biết đâu là đáp án đúng sau khi có result (server trả result.answer.term) — không lộ trước.
            const isCorrectChoice = !!result && result.answer.term === choice;
            const stateClass = !result
              ? 'border-line bg-surface-raised text-ink active:bg-brand/5'
              : isCorrectChoice
                ? 'border-success bg-success/10 text-success'
                : isChosen
                  ? 'border-danger bg-danger/10 text-danger'
                  : 'border-line bg-surface-raised text-ink-muted';
            return (
              <button
                key={choice}
                type="button"
                lang="ja"
                disabled={!!result || pending}
                onClick={() => {
                  setSelectedChoice(choice);
                  submit(choice, null);
                }}
                className={`flex items-center justify-center rounded-xl border px-4 py-4 text-xl font-semibold transition-colors disabled:opacity-90 ${stateClass}`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      ) : typed ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (composing || pending || result || input.trim() === '') return;
            submit(input, null);
          }}
        >
          <input
            key={idx}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              setInput(e.currentTarget.value);
            }}
            readOnly={!!result}
            lang={q.question_type === 'E2' ? 'ja' : 'vi'}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={200}
            placeholder={copy.reviewQuizAnswerPlaceholder[q.question_type as Exclude<QuestionType, 'K2'>]}
            aria-label={copy.reviewQuestionTypeHint[q.question_type]}
            className="w-full rounded-xl border border-line bg-surface-raised px-4 py-3 text-base text-ink"
          />
          {composing ? <p className="text-xs text-ink-muted">{copy.reviewQuizComposing}</p> : null}
          {!result ? (
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={composing || pending || input.trim() === ''}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {copy.reviewQuizSubmit}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(DONT_KNOW, null)}
                className="rounded-xl border border-line px-4 py-3 text-sm text-ink-muted disabled:opacity-50"
              >
                {copy.reviewQuizDontKnow}
              </button>
            </div>
          ) : null}
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <HandwritingCanvas
            ref={canvas}
            label={copy.reviewQuestionTypeLabel.K2}
            onStrokeCountChange={setStrokes}
            onStrokesChange={setDrawnStrokes}
          />
          {!submitted ? (
            // Chưa bấm "Nộp bài": chỉ Xoá/Nộp bài, KHÔNG tính/hiện autoScore (Việc 2 — tránh chấm giữa
            // chừng khi mới vẽ xong đúng-số-nét nhưng chưa báo "xong").
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  canvas.current?.clear();
                  setManualOverride(false);
                }}
                className="flex items-center gap-1 rounded-xl border border-line px-4 py-3 text-sm text-ink"
              >
                <Eraser className="h-4 w-4" aria-hidden="true" />
                {copy.reviewQuizClear}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  // Đóng băng score tại đúng lúc nộp — không tính lại theo drawnStrokes sống sau đó.
                  const score =
                    strokeReference && drawnStrokes.length > 0 ? scoreHandwriting(drawnStrokes, strokeReference) : null;
                  setFrozenAutoScore(score);
                  setSubmitted(true);
                  // Không tự tin (không autoCorrect) → gộp luôn bước xem đáp án, không cần bấm thêm.
                  if (!score?.autoCorrect) doReveal();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {copy.reviewQuizSubmitHandwriting}
              </button>
            </div>
          ) : autoSuggested && !result ? (
            // Tự chấm ĐÚNG (score cao + đúng số nét) — không bao giờ tự chấm SAI bằng máy (CLAUDE.md #4c).
            // Người dùng vẫn có quyền quyết định cuối: giữ kết quả hoặc tự sửa (chuyển sang luồng reveal).
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/40 bg-success/5 p-3">
              <p className="flex items-center gap-2 font-semibold text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                {copy.reviewQuizAutoCorrect}
              </p>
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setManualOverride(true);
                    doReveal();
                  }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line px-3 py-3 text-sm font-semibold text-ink disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {copy.reviewQuizEditResult}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(null, true, true)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-success px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {copy.reviewQuizKeepResult}
                </button>
              </div>
            </div>
          ) : reveal ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-raised p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh tự host */}
              <img src={reveal.svg_path} alt={copy.reviewDetailStrokeOrderAlt(reveal.kanji)} width={160} height={160} className="h-40 w-40" />
              {reveal.stroke_count ? <p className="text-sm text-ink-muted">{copy.reviewQuizStrokeCompare(strokes, reveal.stroke_count)}</p> : null}
              {!result ? (
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit(null, false)}
                    title={copy.reviewQuizSelfWrong}
                    aria-label={copy.reviewQuizSelfWrong}
                    className="flex flex-1 items-center justify-center rounded-xl border border-danger/40 px-3 py-3 text-danger disabled:opacity-50"
                  >
                    <XCircle className="h-7 w-7" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit(null, true)}
                    title={copy.reviewQuizSelfCorrect}
                    aria-label={copy.reviewQuizSelfCorrect}
                    className="flex flex-1 items-center justify-center rounded-xl bg-success px-3 py-3 text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            // Đã bấm Nộp bài, đang chờ doReveal() trả svg thứ tự nét (Server Action).
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface-raised p-3 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {copy.reviewQuizCheckingAnswer}
            </div>
          )}
        </div>
      )}

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-danger bg-danger/5 p-3 text-sm text-danger">
          <span>{error}</span>
        </div>
      ) : null}

      {/* Kết quả + giải thích (chỉ hiện sau khi trả lời) */}
      {result ? (
        <div
          role="status"
          className={`flex flex-col gap-1 rounded-2xl border p-4 ${result.is_correct ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'}`}
        >
          <p className={`flex items-center gap-2 font-semibold ${result.is_correct ? 'text-success' : 'text-danger'}`}>
            {result.is_correct ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <XCircle className="h-5 w-5" aria-hidden="true" />}
            {result.is_correct ? copy.reviewQuizCorrect : copy.reviewQuizWrong}
          </p>
          {q.item_type === 'kanji' ? (
            <p className="text-ink">
              <span className="mr-2 text-3xl" lang="ja">
                {result.answer.kanji}
              </span>
              <span className="font-semibold">{result.answer.han_viet_main}</span>
              {result.answer.han_viet_accepted?.length ? (
                <span className="text-xs text-ink-muted"> ({copy.reviewDetailHanVietAccepted(result.answer.han_viet_accepted.join(', '))})</span>
              ) : null}
            </p>
          ) : (
            <p className="text-ink">
              <span className="mr-2 text-2xl" lang="ja">
                {result.answer.term}
              </span>
              <span className="text-sm" lang="ja">
                {result.answer.reading_kana}
              </span>
              {result.answer.han_viet ? <span className="ml-2 font-semibold">{result.answer.han_viet}</span> : null}
            </p>
          )}
          {result.answer.meaning_vi ? <p className="text-sm text-ink">{result.answer.meaning_vi}</p> : null}
          <p className="text-xs text-ink-muted">{copy.reviewQuizMasteryNow(copy.reviewMasteryLabel[result.new_mastery_level])}</p>
          {result.is_correct ? (
            // Trả lời đúng → tự nhảy câu sau ~1.4s (effect ở trên), KHÔNG render nút "Câu tiếp" nữa (nó sẽ
            // xuất hiện-rồi-biến-mất trong lúc chờ, tạo cảm giác giật). Thay bằng dòng chữ tĩnh, không bấm được.
            <p className="mt-2 text-center text-sm text-ink-muted">{copy.reviewQuizAutoAdvancing}</p>
          ) : (
            <button type="button" autoFocus onClick={goNext} className="mt-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white">
              {isLast ? copy.reviewQuizFinish : copy.reviewQuizNext}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
