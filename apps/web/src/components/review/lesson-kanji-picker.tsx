'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronRight, Dumbbell } from 'lucide-react';
import { AddToListForm } from './add-to-list-form';
import type { LessonGroup } from '@/lib/review-data';
import { copy } from '@/lib/copy';

/**
 * Chọn kanji để luyện/lưu danh sách trên NHIỀU bài cùng lúc — thay cho Duyệt kanji (1 bài/lần) + Danh
 * sách (phải tạo list con cho mỗi bài rồi gộp). Mỗi bài có checkbox chọn cả bài + mở rộng chọn từng chữ,
 * độc lập giữa các bài (xem CLAUDE.md phản hồi #4/#6).
 */
export function LessonKanjiPicker({
  lessons,
  lists,
  returnTo,
  initialLesson,
}: {
  lessons: LessonGroup[];
  lists: { id: string; name: string }[];
  returnTo: string;
  initialLesson?: number;
}) {
  const [expanded, setExpanded] = useState<number | null>(initialLesson ?? null);
  const [selected, setSelected] = useState<string[]>([]);
  const toggleKanji = (hex: string) => setSelected((s) => (s.includes(hex) ? s.filter((h) => h !== hex) : [...s, hex]));
  const toggleLesson = (group: LessonGroup) => {
    const hexes = group.kanji.map((k) => k.unicode_hex);
    const allSelected = hexes.every((h) => selected.includes(h));
    setSelected((s) => (allSelected ? s.filter((h) => !hexes.includes(h)) : [...new Set([...s, ...hexes])]));
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {lessons.map((group) => {
          const isOpen = expanded === group.lesson;
          const hexes = group.kanji.map((k) => k.unicode_hex);
          const allSelected = hexes.length > 0 && hexes.every((h) => selected.includes(h));
          const someSelected = !allSelected && hexes.some((h) => selected.includes(h));
          return (
            <li key={group.lesson} className="rounded-xl border border-line bg-surface-raised">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => toggleLesson(group)}
                  aria-pressed={allSelected}
                  aria-label={`${copy.reviewPracticeSelectAllLesson} ${copy.reviewLessonLabel(group.lesson)}`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border active:scale-95 ${
                    allSelected
                      ? 'border-brand bg-brand text-white'
                      : someSelected
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-line bg-surface text-transparent'
                  }`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : group.lesson)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                >
                  <span className="font-semibold text-ink">{copy.reviewLessonLabel(group.lesson)}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                    {group.kanji.length}
                    {isOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  </span>
                </button>
              </div>
              {isOpen ? (
                <ul className="grid grid-cols-4 gap-2 border-t border-line p-3 sm:grid-cols-8">
                  {group.kanji.map((k) => {
                    const isSel = selected.includes(k.unicode_hex);
                    return (
                      <li key={k.unicode_hex} className="relative">
                        <Link
                          href={`/review/browse/${k.unicode_hex}`}
                          title={copy.reviewPracticeDetailLink}
                          className={`flex aspect-square w-full flex-col items-center justify-center rounded-xl border bg-surface active:scale-95 ${
                            isSel ? 'border-brand ring-2 ring-brand/30' : 'border-line'
                          }`}
                        >
                          <span className="text-2xl leading-none text-ink" lang="ja">
                            {k.kanji}
                          </span>
                          <span className="mt-1 max-w-full truncate px-1 text-[10px] text-ink-muted">{k.han_viet_main ?? '—'}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleKanji(k.unicode_hex)}
                          aria-pressed={isSel}
                          aria-label={k.kanji}
                          className={`absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border ${
                            isSel ? 'border-brand bg-brand text-white' : 'border-line bg-surface'
                          }`}
                        >
                          {isSel ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {selected.length > 0 ? (
        <div className="sticky bottom-2 z-30 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-lg">
          <span className="text-center text-sm text-ink-muted" aria-live="polite">
            {copy.reviewPracticeSelectedCount(selected.length)}
          </span>
          <Link
            href={`/review/quiz/new?scope=${encodeURIComponent(`kanji:${selected.join('.')}`)}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white active:scale-95"
          >
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            {copy.reviewPracticeStart(selected.length)}
          </Link>
          <AddToListForm lists={lists} items={selected.map((h) => `kanji:${h}`)} returnTo={returnTo} compact />
        </div>
      ) : null}
    </div>
  );
}
