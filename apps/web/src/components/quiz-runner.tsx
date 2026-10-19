'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { scoreHandwriting, type StrokePath, type StrokePoint } from '@roadmap/core';
import { copy } from '@/lib/copy';
import {
  getQuizBatchAction,
  revealAnswerAction,
  submitAnswerAction,
  type QuizBatchItem,
  type ReviewItemType,
  type ReviewQuestionType,
} from '@/app/(app)/review/quiz/run/actions';

// Envelope lưu ở sessionStorage bởi quiz-scope-picker.tsx — key 'reviewQuizPlan', KHÔNG chứa đáp án
// (chỉ item cần hỏi), đúng yêu cầu "không lưu đáp án đúng ở client".
interface PlanEnvelope {
  itemType: ReviewItemType;
  itemId: string;
  questionType: ReviewQuestionType;
}

const CANVAS_SIZE = 320;

type RunState = 'loading' | 'no_plan' | 'error' | 'ready' | 'finished';

// Trạng thái hiển thị sau khi đã có kết quả cho câu hiện tại (mọi loại câu hỏi).
interface AnsweredResult {
  isCorrect: boolean;
  correctAnswerDisplay: string | null;
}

export function QuizRunner() {
  const [runState, setRunState] = useState<RunState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizBatchItem[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [answered, setAnswered] = useState<AnsweredResult | null>(null);

  // Load plan từ sessionStorage + gọi Server Action lấy đề (chỉ 1 lần lúc mount).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem('reviewQuizPlan');
    } catch {
      raw = null;
    }
    if (!raw) {
      setRunState('no_plan');
      return;
    }
    let plan: PlanEnvelope[] = [];
    try {
      plan = JSON.parse(raw);
    } catch {
      plan = [];
    }
    if (!Array.isArray(plan) || plan.length === 0) {
      setRunState('no_plan');
      return;
    }

    const itemRefKeys = new Set<string>();
    const itemRefs: Array<{ itemType: ReviewItemType; itemId: string }> = [];
    for (const p of plan) {
      const key = `${p.itemType}:${p.itemId}`;
      if (!itemRefKeys.has(key)) {
        itemRefKeys.add(key);
        itemRefs.push({ itemType: p.itemType, itemId: p.itemId });
      }
    }
    const questionTypes = Array.from(new Set(plan.map((p) => p.questionType)));

    (async () => {
      const result = await getQuizBatchAction(itemRefs, questionTypes, plan.length);
      if (!result.ok || !result.items) {
        setErrorMessage(result.message ?? copy.reviewQuizLoadError);
        setRunState('error');
        return;
      }
      // Ghép lại theo đúng thứ tự plan (buildQuizPlan) — khớp từng cặp (itemId, questionType) với
      // 1 câu trong batch trả về (RPC tự xáo trộn ngẫu nhiên nên phải map lại theo key, không theo
      // thứ tự mảng); nếu batch không đủ hoặc thiếu 1 cặp cụ thể (hiếm, xem giải thích trong actions.ts
      // — RPC giới hạn p_limit trên toàn bộ tổ hợp item×type, không đảm bảo 100% trùng khớp plan khi
      // phạm vi câu hỏi được chọn không đồng nhất giữa các item), dùng ngay câu còn lại cùng loại —
      // chấp nhận lệch thứ tự nhỏ, KHÔNG làm sai phạm vi (vẫn đúng item/loại câu hỏi đã chọn).
      const pool = [...result.items];
      const ordered: QuizBatchItem[] = [];
      for (const p of plan) {
        let foundIndex = pool.findIndex((b) => b.itemId === p.itemId && b.questionType === p.questionType);
        if (foundIndex === -1) foundIndex = pool.findIndex((b) => b.questionType === p.questionType);
        if (foundIndex === -1) continue;
        ordered.push(pool[foundIndex]);
        pool.splice(foundIndex, 1);
      }
      if (ordered.length === 0) {
        setErrorMessage(copy.reviewQuizLoadError);
        setRunState('error');
        return;
      }
      setQuestions(ordered);
      setScore({ correct: 0, total: 0 });
      setRunState('ready');
    })();
  }, []);

  const current = runState === 'ready' ? questions[index] : null;

  function handleAnswered(isCorrect: boolean, correctAnswerDisplay: string | null) {
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setAnswered({ isCorrect, correctAnswerDisplay });
  }

  function handleNext() {
    setAnswered(null);
    if (index + 1 >= questions.length) {
      setRunState('finished');
    } else {
      setIndex((i) => i + 1);
    }
  }

  if (runState === 'loading') {
    return <p className="text-sm text-ink-muted">...</p>;
  }

  if (runState === 'no_plan') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-ink-muted">{copy.reviewQuizNoPlanMessage}</p>
        <Link href="/review/quiz/new" className="btn-primary">
          {copy.reviewQuizBackToNew}
        </Link>
      </div>
    );
  }

  if (runState === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-danger">{errorMessage}</p>
        <Link href="/review/quiz/new" className="btn-primary">
          {copy.reviewQuizBackToNew}
        </Link>
      </div>
    );
  }

  if (runState === 'finished') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <h1 className="text-2xl font-bold text-ink">{copy.reviewQuizSummaryTitle}</h1>
        <p className="text-lg text-ink-muted">{copy.reviewQuizSummaryScore(score.correct, score.total)}</p>
        <Link href="/review" className="btn-primary">
          {copy.reviewQuizSummaryBackHome}
        </Link>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 text-sm text-ink-muted">{copy.reviewQuizProgressLabel(index + 1, questions.length)}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(((index + 1) / questions.length) * 100)}%` }} />
        </div>
      </div>

      {current.questionType === 'K2' ? (
        <K2Question key={`${current.itemId}-${index}`} item={current} answered={answered} onAnswered={handleAnswered} />
      ) : (
        <TextQuestion key={`${current.itemId}-${index}`} item={current} answered={answered} onAnswered={handleAnswered} />
      )}

      {answered ? (
        <button type="button" onClick={handleNext} className="btn-primary w-full">
          {copy.reviewQuizNextQuestionButton}
        </button>
      ) : null}
    </div>
  );
}

// ============ Câu đọc: K1 (kanji), E1 (từ ví dụ), E2 (nghĩa -> tiếng Nhật) ============

function questionPrompt(item: QuizBatchItem): string {
  if (item.questionType === 'K1') return (item.payload.kanji as string) ?? '?';
  if (item.questionType === 'E1') return (item.payload.term as string) ?? '?';
  return (item.payload.meaning_vi as string) ?? '?'; // E2
}

function TextQuestion({
  item,
  answered,
  onAnswered,
}: {
  item: QuizBatchItem;
  answered: AnsweredResult | null;
  onAnswered: (isCorrect: boolean, correctAnswerDisplay: string | null) => void;
}) {
  const [value, setValue] = useState('');
  const [composing, setComposing] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(answerText: string) {
    setPending(true);
    const result = await submitAnswerAction({
      itemType: item.itemType,
      itemId: item.itemId,
      questionType: item.questionType,
      answerText,
      selfCorrect: null,
      clientAttemptId: crypto.randomUUID(),
      autoGraded: false,
    });
    setPending(false);
    if (result.ok) onAnswered(Boolean(result.isCorrect), result.correctAnswerDisplay ?? null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-5">
      <p className="text-5xl font-medium text-ink" style={{ fontSize: item.questionType === 'K1' ? '3.5rem' : '1.5rem' }}>
        {questionPrompt(item)}
      </p>

      {!answered ? (
        <>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            disabled={pending}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink"
          />
          {composing ? <p className="text-xs text-ink-faint">{copy.reviewQuizImeHint}</p> : null}
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => submit('')} className="btn-premium flex-1">
              {copy.reviewQuizPassButton}
            </button>
            <button
              type="button"
              disabled={pending || composing || value.trim().length === 0}
              onClick={() => submit(value)}
              className="btn-primary flex-1"
            >
              {copy.reviewQuizSubmitButton}
            </button>
          </div>
        </>
      ) : (
        <ResultBanner answered={answered} />
      )}
    </div>
  );
}

function ResultBanner({ answered }: { answered: AnsweredResult }) {
  return (
    <div className={`rounded-lg p-3 text-sm ${answered.isCorrect ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
      <p className="font-medium">{answered.isCorrect ? copy.reviewQuizResultCorrect : copy.reviewQuizResultWrong}</p>
      {answered.correctAnswerDisplay ? <p>{copy.reviewQuizCorrectAnswerLabel(answered.correctAnswerDisplay)}</p> : null}
    </div>
  );
}

// ============ Câu viết: K2 (Hán Việt + nghĩa Anh -> viết kanji) ============

function parseStrokePoints(raw: unknown): StrokePath[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  return raw as StrokePath[];
}

function K2Question({
  item,
  answered,
  onAnswered,
}: {
  item: QuizBatchItem;
  answered: AnsweredResult | null;
  onAnswered: (isCorrect: boolean, correctAnswerDisplay: string | null) => void;
}) {
  const referenceStrokes = useMemo(() => parseStrokePoints(item.payload.stroke_points), [item.payload.stroke_points]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<StrokePath[]>([]);
  const currentStrokeRef = useRef<StrokePath>([]);
  const [drawing, setDrawing] = useState(false);
  const [pending, setPending] = useState(false);
  const [autoResult, setAutoResult] = useState<{ autoGraded: boolean; isCorrect: boolean } | null>(null);
  const [reveal, setReveal] = useState<{ kanji?: string; svgPath?: string; hanVietMain?: string | null; meaningEn?: string | null } | null>(
    null,
  );
  const [showReferenceOverlay, setShowReferenceOverlay] = useState(false);

  function redraw() {
    const canvas = canvasRef.current;
    if (typeof window === 'undefined' || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'var(--color-line)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    if (showReferenceOverlay && referenceStrokes) {
      ctx.strokeStyle = 'var(--color-ink-faint)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.4;
      for (const stroke of referenceStrokes) {
        if (stroke.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x * canvas.width, stroke[0].y * canvas.height);
        for (const p of stroke.slice(1)) ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = 'var(--color-brand)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, showReferenceOverlay]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current;
    const rect = canvas!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (answered || reveal || autoResult) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    currentStrokeRef.current = [pointFromEvent(e)];
    setDrawing(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    currentStrokeRef.current = [...currentStrokeRef.current, pointFromEvent(e)];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || currentStrokeRef.current.length < 2) return;
    const pts = currentStrokeRef.current;
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    ctx.strokeStyle = 'var(--color-brand)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function handlePointerUp() {
    if (!drawing) return;
    setDrawing(false);
    if (currentStrokeRef.current.length >= 2) setStrokes((prev) => [...prev, currentStrokeRef.current]);
    currentStrokeRef.current = [];
  }

  function handleClear() {
    setStrokes([]);
    currentStrokeRef.current = [];
  }

  function normalizedStrokes(): StrokePath[] {
    return strokes.map((s) => s.map((p) => ({ x: p.x / CANVAS_SIZE, y: p.y / CANVAS_SIZE })));
  }

  async function handleDontRemember() {
    setPending(true);
    const result = await submitAnswerAction({
      itemType: item.itemType,
      itemId: item.itemId,
      questionType: 'K2',
      answerText: null,
      selfCorrect: false,
      clientAttemptId: crypto.randomUUID(),
      autoGraded: false,
    });
    const r = await revealAnswerAction(item.itemType, item.itemId, 'K2');
    setPending(false);
    if (r.ok) setReveal({ kanji: r.kanji, svgPath: r.svgPath, hanVietMain: r.hanVietMain, meaningEn: r.meaningEn });
    if (result.ok) onAnswered(false, result.correctAnswerDisplay ?? null);
  }

  async function handleDone() {
    if (strokes.length === 0) {
      await handleDontRemember();
      return;
    }
    const heuristic = referenceStrokes ? scoreHandwriting(normalizedStrokes(), referenceStrokes) : null;
    if (heuristic && heuristic.autoCorrect) {
      setPending(true);
      const result = await submitAnswerAction({
        itemType: item.itemType,
        itemId: item.itemId,
        questionType: 'K2',
        answerText: null,
        selfCorrect: true,
        clientAttemptId: crypto.randomUUID(),
        autoGraded: true,
      });
      setPending(false);
      setAutoResult({ autoGraded: true, isCorrect: true });
      if (result.ok) onAnswered(true, result.correctAnswerDisplay ?? null);
      return;
    }
    // Không auto-correct (score thấp hoặc không có stroke_points tham chiếu) -> rơi về tự xác nhận.
    setPending(true);
    const r = await revealAnswerAction(item.itemType, item.itemId, 'K2');
    setPending(false);
    if (r.ok) setReveal({ kanji: r.kanji, svgPath: r.svgPath, hanVietMain: r.hanVietMain, meaningEn: r.meaningEn });
  }

  async function handleSelfAssess(isCorrect: boolean) {
    setPending(true);
    const result = await submitAnswerAction({
      itemType: item.itemType,
      itemId: item.itemId,
      questionType: 'K2',
      answerText: null,
      selfCorrect: isCorrect,
      clientAttemptId: crypto.randomUUID(),
      autoGraded: false,
    });
    setPending(false);
    if (result.ok) onAnswered(isCorrect, result.correctAnswerDisplay ?? null);
  }

  // "Sửa kết quả": người dùng tự override kết quả auto-grade — gọi lại submit với self_correct=false,
  // auto_graded=false (1 lần submit MỚI, idempotency theo client_attempt_id riêng, không sửa log cũ).
  async function handleFixAutoResult() {
    setPending(true);
    const result = await submitAnswerAction({
      itemType: item.itemType,
      itemId: item.itemId,
      questionType: 'K2',
      answerText: null,
      selfCorrect: false,
      clientAttemptId: crypto.randomUUID(),
      autoGraded: false,
    });
    const r = await revealAnswerAction(item.itemType, item.itemId, 'K2');
    setPending(false);
    setAutoResult(null);
    if (r.ok) setReveal({ kanji: r.kanji, svgPath: r.svgPath, hanVietMain: r.hanVietMain, meaningEn: r.meaningEn });
    if (result.ok) onAnswered(false, result.correctAnswerDisplay ?? null);
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface-raised p-5">
      <div className="text-center">
        <p className="text-2xl font-semibold text-ink">{item.payload.han_viet_main as string}</p>
        <p className="text-sm text-ink-muted">{item.payload.meaning_en as string}</p>
      </div>

      {!answered && !autoResult ? (
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{ touchAction: 'none', width: `min(${CANVAS_SIZE}px, calc(100vw - 32px))`, aspectRatio: '1 / 1' }}
          className="rounded-xl border border-line bg-surface"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      ) : null}

      {!answered && !autoResult && !reveal ? (
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={handleClear} className="btn-premium">
            {copy.reviewQuizK2ClearCanvas}
          </button>
          <button type="button" disabled={pending} onClick={handleDontRemember} className="btn-premium">
            {copy.reviewQuizK2DontRemember}
          </button>
          <button type="button" disabled={pending} onClick={handleDone} className="btn-primary">
            {copy.reviewQuizK2Done}
          </button>
        </div>
      ) : null}

      {autoResult ? (
        <div className="flex w-full flex-col items-center gap-2">
          <Check className="h-10 w-10 text-success" strokeWidth={3} />
          <p className="text-xs text-ink-muted">{copy.reviewQuizK2AutoGradedHint}</p>
          <button type="button" disabled={pending} onClick={handleFixAutoResult} className="btn-premium text-xs">
            {copy.reviewQuizK2FixResult}
          </button>
        </div>
      ) : null}

      {reveal ? (
        <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-line bg-surface p-4">
          <p className="text-6xl text-ink">{reveal.kanji}</p>
          {referenceStrokes && referenceStrokes.length > 0 ? (
            <button type="button" onClick={() => setShowReferenceOverlay((s) => !s)} className="btn-premium text-xs">
              {showReferenceOverlay ? copy.reviewQuizK2HideStrokes : copy.reviewQuizK2ShowStrokes}
            </button>
          ) : null}
          {reveal.svgPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh do app tự host, không phải nội dung người dùng/LLM sinh
            <img src={reveal.svgPath} alt={reveal.kanji ? `Thứ tự nét ${reveal.kanji}` : ''} loading="lazy" className="h-24 w-24" />
          ) : null}
          {!answered ? (
            <>
              <p className="text-sm text-ink-muted">{copy.reviewQuizK2SelfAssessPrompt}</p>
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleSelfAssess(false)}
                  className="flex flex-1 items-center justify-center rounded-xl border border-danger py-3 text-danger"
                >
                  <X className="h-7 w-7" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleSelfAssess(true)}
                  className="flex flex-1 items-center justify-center rounded-xl border border-success py-3 text-success"
                >
                  <Check className="h-7 w-7" strokeWidth={3} />
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {answered ? <ResultBanner answered={answered} /> : null}
    </div>
  );
}
