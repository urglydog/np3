'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildQuizPlan,
  maxQuestionsFor,
  pickQuizCandidates,
  type QuestionType,
  type QuizCandidate,
  type SmartStrategy,
} from '@roadmap/core';
import { copy } from '@/lib/copy';
import { QUESTION_TYPE_LABEL, SMART_STRATEGY_LABEL } from '@/lib/review-quiz-candidates';

// Quyết định kỹ thuật (xem báo cáo cuối task): gộp "Quiz scope" + "Quiz settings" vào CÙNG 1 trang
// (`review/quiz/new`) bằng state client `step`, thay vì 2 route riêng — đơn giản hơn vì không cần
// truyền phạm vi đã chọn (list ứng viên khá lớn) qua query string/URL giữa 2 trang.
type Step = 'scope' | 'settings';
type Tab = 'smart' | 'customized';

const SMART_STRATEGIES: SmartStrategy[] = ['least_streak', 'least_accuracy', 'least_reviewed', 'unseen_first'];
const ALL_QUESTION_TYPES: QuestionType[] = ['K1', 'E1', 'K2', 'E2'];

export interface ListOptionWithItems {
  id: string;
  name: string;
  items: Array<{ itemType: 'kanji' | 'example'; itemId: string }>;
}

export interface QuizScopePickerProps {
  kanjiCandidates: QuizCandidate[];
  exampleCandidates: QuizCandidate[];
  // itemId -> các bài (deck_lesson với kanji, lesson_context với ví dụ) chứa item đó.
  lessonByItemId: Record<string, number[]>;
  seededLessons: number[];
  lists: ListOptionWithItems[];
}

export function QuizScopePicker({ kanjiCandidates, exampleCandidates, lessonByItemId, seededLessons, lists }: QuizScopePickerProps) {
  const router = useRouter();
  const allCandidates = useMemo(() => [...kanjiCandidates, ...exampleCandidates], [kanjiCandidates, exampleCandidates]);
  const candidateByKey = useMemo(() => {
    const m = new Map<string, QuizCandidate>();
    for (const c of allCandidates) m.set(`${c.itemType}:${c.itemId}`, c);
    return m;
  }, [allCandidates]);

  const [step, setStep] = useState<Step>('scope');
  const [tab, setTab] = useState<Tab>('smart');

  // Smart quiz
  const [strategy, setStrategy] = useState<SmartStrategy>('least_streak');
  const [smartCount, setSmartCount] = useState<number>(Math.min(16, allCandidates.length));

  // Customized
  const [selectedLessons, setSelectedLessons] = useState<Set<number>>(new Set());
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());

  const customizedCandidates = useMemo((): QuizCandidate[] => {
    if (selectedLessons.size === 0 && selectedListIds.size === 0) return [];
    const keys = new Set<string>();
    const out: QuizCandidate[] = [];
    function add(c: QuizCandidate) {
      const key = `${c.itemType}:${c.itemId}`;
      if (keys.has(key)) return;
      keys.add(key);
      out.push(c);
    }
    if (selectedLessons.size > 0) {
      for (const c of allCandidates) {
        const lessons = lessonByItemId[c.itemId] ?? [];
        if (lessons.some((l) => selectedLessons.has(l))) add(c);
      }
    }
    if (selectedListIds.size > 0) {
      for (const list of lists) {
        if (!selectedListIds.has(list.id)) continue;
        for (const it of list.items) {
          const c = candidateByKey.get(`${it.itemType}:${it.itemId}`);
          if (c) add(c);
        }
      }
    }
    return out;
  }, [allCandidates, lessonByItemId, selectedLessons, selectedListIds, lists, candidateByKey]);

  const smartPicked = useMemo(
    () => pickQuizCandidates(allCandidates, strategy, Math.max(0, Math.min(smartCount, allCandidates.length))),
    [allCandidates, strategy, smartCount],
  );

  const scopedCandidates = tab === 'smart' ? smartPicked : customizedCandidates;
  const scopeCount = scopedCandidates.length;

  // Settings (bước 2)
  const [questionTypes, setQuestionTypes] = useState<Set<QuestionType>>(new Set(ALL_QUESTION_TYPES));
  const maxQuestions = maxQuestionsFor(scopedCandidates);
  const [questionCount, setQuestionCount] = useState<number>(Math.min(10, maxQuestions || 1));

  function toggleLesson(l: number) {
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });
  }

  function toggleList(id: string) {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleQuestionType(qt: QuestionType) {
    setQuestionTypes((prev) => {
      const next = new Set(prev);
      if (next.has(qt)) next.delete(qt);
      else next.add(qt);
      return next;
    });
  }

  function goToSettings() {
    const cap = maxQuestionsFor(scopedCandidates);
    setQuestionCount(Math.min(10, cap || 1));
    setStep('settings');
  }

  function handleStart() {
    const wanted = Array.from(questionTypes);
    const cap = Math.max(0, Math.min(questionCount, maxQuestionsFor(scopedCandidates)));
    const plan = buildQuizPlan(scopedCandidates, wanted, cap);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('reviewQuizPlan', JSON.stringify(plan));
      } catch {
        // sessionStorage có thể bị chặn (chế độ ẩn danh) — vẫn điều hướng, trang run sẽ báo lỗi "không có quiz".
      }
    }
    router.push('/review/quiz/run');
  }

  if (step === 'settings') {
    const applicableTypes = new Set<QuestionType>();
    for (const c of scopedCandidates) for (const qt of c.applicableQuestionTypes) applicableTypes.add(qt);

    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-ink">{copy.reviewQuizSettingsTitle}</h2>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-muted">{copy.reviewQuizQuestionTypesLabel}</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_QUESTION_TYPES.filter((qt) => applicableTypes.has(qt)).map((qt) => (
              <label
                key={qt}
                className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${
                  questionTypes.has(qt) ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink-muted'
                }`}
              >
                <input type="checkbox" checked={questionTypes.has(qt)} onChange={() => toggleQuestionType(qt)} />
                {QUESTION_TYPE_LABEL[qt]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="quiz-question-count" className="mb-2 block text-sm font-medium text-ink-muted">
            {copy.reviewQuizQuestionCountLabel(questionCount)}
          </label>
          <input
            id="quiz-question-count"
            type="range"
            min={1}
            max={Math.max(1, maxQuestions)}
            value={Math.min(questionCount, Math.max(1, maxQuestions))}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full"
            disabled={maxQuestions === 0}
          />
        </div>

        {maxQuestions === 0 ? <p className="text-sm text-danger">{copy.reviewQuizNoCandidates}</p> : null}
        {questionTypes.size === 0 ? <p className="text-sm text-danger">{copy.reviewQuizNoQuestionTypes}</p> : null}

        <div className="flex gap-2">
          <button type="button" onClick={() => setStep('scope')} className="btn-premium flex-1">
            {copy.reviewQuizBackButton}
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={maxQuestions === 0 || questionTypes.size === 0}
            className="btn-primary flex-1"
          >
            {copy.reviewQuizStartButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 rounded-xl border border-line bg-surface-raised p-1">
        <button
          type="button"
          onClick={() => setTab('smart')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === 'smart' ? 'bg-brand text-white' : 'text-ink-muted'}`}
        >
          {copy.reviewQuizTabSmart}
        </button>
        <button
          type="button"
          onClick={() => setTab('customized')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === 'customized' ? 'bg-brand text-white' : 'text-ink-muted'}`}
        >
          {copy.reviewQuizTabCustomized}
        </button>
      </div>

      {tab === 'smart' ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-muted">{copy.reviewQuizSmartStrategyLabel}</p>
            <div className="flex flex-col gap-2">
              {SMART_STRATEGIES.map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${
                    strategy === s ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink-muted'
                  }`}
                >
                  <input type="radio" name="smart-strategy" checked={strategy === s} onChange={() => setStrategy(s)} />
                  {SMART_STRATEGY_LABEL[s]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="smart-count" className="mb-2 block text-sm font-medium text-ink-muted">
              {copy.reviewQuizSmartCountLabel(allCandidates.length)}
            </label>
            <input
              id="smart-count"
              type="range"
              min={0}
              max={Math.max(0, allCandidates.length)}
              value={smartCount}
              onChange={(e) => setSmartCount(Number(e.target.value))}
              className="w-full"
            />
            <p className="mt-1 text-right text-sm text-ink">{smartCount}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-muted">{copy.reviewQuizCustomizedByLesson}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {seededLessons.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleLesson(l)}
                  className={`rounded-lg border p-2 text-sm ${
                    selectedLessons.has(l) ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink-muted'
                  }`}
                >
                  {copy.reviewLessonLabel(l)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink-muted">{copy.reviewQuizCustomizedByList}</p>
            {lists.length === 0 ? (
              <p className="text-sm text-ink-muted">{copy.reviewQuizNoListsYet}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {lists.map((l) => (
                  <label
                    key={l.id}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${
                      selectedListIds.has(l.id) ? 'border-brand bg-brand/10 text-ink' : 'border-line text-ink-muted'
                    }`}
                  >
                    <input type="checkbox" checked={selectedListIds.has(l.id)} onChange={() => toggleList(l.id)} />
                    {l.name} ({l.items.length})
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="sticky bottom-16 flex items-center justify-between rounded-xl border border-line bg-surface-raised p-3 shadow-lg">
        <span className="text-sm text-ink">{copy.reviewQuizScopeCount(scopeCount)}</span>
        <button type="button" disabled={scopeCount === 0} onClick={goToSettings} className="btn-primary">
          {copy.reviewQuizNextButton}
        </button>
      </div>
    </div>
  );
}
