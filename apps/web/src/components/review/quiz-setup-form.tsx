'use client';

import { useState } from 'react';
import type { QuestionType } from '@roadmap/core';
import { copy } from '@/lib/copy';

const ORDER: QuestionType[] = ['K1', 'E1', 'K2', 'E2'];

/**
 * Chọn loại câu + số câu. Trần thanh trượt = tổng số câu có thể hỏi của các loại đang bật (≤ maxCap).
 * Gửi GET tới /review/quiz để trang quiz tải lại được (không lưu phiên trên server).
 */
export function QuizSetupForm({ scopeParam, counts, maxCap }: { scopeParam: string; counts: Record<QuestionType, number>; maxCap: number }) {
  const available = ORDER.filter((q) => counts[q] > 0);
  const [types, setTypes] = useState<QuestionType[]>(available);
  const max = Math.min(maxCap, types.reduce((n, q) => n + counts[q], 0));
  const [n, setN] = useState(Math.min(20, Math.max(1, max)));
  const value = Math.min(n, Math.max(1, max));

  return (
    <form action="/review/quiz" method="get" className="flex flex-col gap-5">
      <input type="hidden" name="scope" value={scopeParam} />
      <input type="hidden" name="types" value={types.join(',')} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink">{copy.reviewQuizTypes}</legend>
        {ORDER.map((q) => {
          const disabled = counts[q] === 0;
          const checked = types.includes(q);
          return (
            <label
              key={q}
              className={`flex items-start gap-3 rounded-xl border p-3 ${checked ? 'border-brand bg-brand/5' : 'border-line bg-surface-raised'} ${
                disabled ? 'opacity-50' : ''
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand"
                checked={checked}
                disabled={disabled}
                onChange={(e) => setTypes((t) => (e.target.checked ? ORDER.filter((x) => x === q || t.includes(x)) : t.filter((x) => x !== q)))}
              />
              <span className="flex flex-col">
                <span className="font-medium text-ink">{copy.reviewQuestionTypeLabel[q]}</span>
                <span className="text-xs text-ink-muted">{copy.reviewQuestionTypeHint[q]}</span>
                <span className="text-[11px] text-ink-muted">{copy.reviewQuizTypeCount(counts[q])}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {types.length === 0 ? (
        <p className="text-sm text-danger">{copy.reviewQuizNoTypeSelected}</p>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink">{copy.reviewQuizCount(value)}</span>
          <input
            type="range"
            name="n"
            min={1}
            max={Math.max(1, max)}
            value={value}
            onChange={(e) => setN(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <span className="flex justify-between text-[11px] text-ink-muted">
            <span>1</span>
            <span>{max}</span>
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={types.length === 0 || max === 0}
        className="rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {copy.reviewQuizStart}
      </button>
    </form>
  );
}
