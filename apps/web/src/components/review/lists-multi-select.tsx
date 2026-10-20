'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Dumbbell } from 'lucide-react';
import { copy } from '@/lib/copy';

export interface PickerList {
  id: string;
  name: string;
  item_count: number;
}

/**
 * Danh sách "Danh sách của tôi" cho phép chọn nhiều (checkbox) rồi luyện gộp — bấm vào tên vẫn
 * đi tới trang chi tiết như trước; bấm ô chọn (hoặc bật chế độ chọn) để tích nhiều danh sách.
 * Theo đúng pattern của LessonKanjiPicker (apps/web/src/components/review/lesson-kanji-picker.tsx).
 */
export function ListsMultiSelect({ lists }: { lists: PickerList[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-3 pb-20">
      <p className="text-xs text-ink-muted">{copy.reviewListsSelectHint}</p>
      <ul className="flex flex-col gap-2">
        {lists.map((l) => {
          const isSel = selected.includes(l.id);
          return (
            <li key={l.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(l.id)}
                aria-pressed={isSel}
                aria-label={l.name}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                  isSel ? 'border-brand bg-brand text-white' : 'border-line bg-surface-raised text-transparent'
                }`}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
              <Link
                href={`/review/lists/${l.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-surface-raised p-4 active:bg-brand/5"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-ink">{l.name}</span>
                  <span className="text-xs text-ink-muted">{copy.reviewListItemCount(l.item_count)}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-ink-faint" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>

      {selected.length > 0 ? (
        <div className="sticky bottom-2 z-30 rounded-2xl border border-line bg-surface p-2 shadow-lg">
          <Link
            href={`/review/quiz/new?scope=${encodeURIComponent(`list:${selected.join(',')}`)}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-base font-semibold text-white"
          >
            <Dumbbell className="h-5 w-5" aria-hidden="true" />
            {copy.reviewListsPracticeSelected(selected.length)}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
