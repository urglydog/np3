'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Dumbbell } from 'lucide-react';
import { AddToListForm } from './add-to-list-form';
import { copy } from '@/lib/copy';

export interface PickerKanji {
  hex: string;
  kanji: string;
  hanViet: string | null;
  pending: boolean;
}

/**
 * Lưới kanji của một bài. Mặc định bấm ô → trang chi tiết; bật "Chọn nhiều" → bấm ô để chọn,
 * thanh hành động hiện phía dưới (Luyện ngay / Thêm vào danh sách). Không dựa vào hover.
 */
export function KanjiPicker({ items, lists, returnTo }: { items: PickerKanji[]; lists: { id: string; name: string }[]; returnTo: string }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (hex: string) => setSelected((s) => (s.includes(hex) ? s.filter((h) => h !== hex) : [...s, hex]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-muted" aria-live="polite">
          {selecting ? copy.reviewBrowseSelectedCount(selected.length) : null}
        </span>
        <button
          type="button"
          onClick={() => {
            setSelecting((v) => !v);
            setSelected([]);
          }}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${selecting ? 'border-brand bg-brand/10 text-brand' : 'border-line text-ink-muted'}`}
        >
          {selecting ? copy.reviewBrowseSelectDone : copy.reviewBrowseSelect}
        </button>
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {items.map((k) => {
          const isSel = selected.includes(k.hex);
          const inner = (
            <>
              <span className="text-3xl leading-none text-ink" lang="ja">
                {k.kanji}
              </span>
              <span className="mt-1 max-w-full truncate px-1 text-[11px] text-ink-muted">{k.hanViet ?? '—'}</span>
              {k.pending ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning" title={copy.reviewPendingBadgeTitle} /> : null}
              {selecting ? (
                <span
                  className={`absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border ${isSel ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}
                  aria-hidden="true"
                >
                  {isSel ? <Check className="h-3 w-3" /> : null}
                </span>
              ) : null}
            </>
          );
          const cls = `relative flex aspect-square w-full flex-col items-center justify-center rounded-xl border bg-surface-raised ${
            isSel ? 'border-brand ring-2 ring-brand/30' : 'border-line'
          }`;
          return (
            <li key={k.hex}>
              {selecting ? (
                <button type="button" onClick={() => toggle(k.hex)} aria-pressed={isSel} className={cls}>
                  {inner}
                </button>
              ) : (
                <Link href={`/review/browse/${k.hex}`} className={cls}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {selecting && selected.length > 0 ? (
        <div className="sticky bottom-2 z-30 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-lg">
          <Link
            href={`/review/quiz/new?scope=${encodeURIComponent(`kanji:${selected.join('.')}`)}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
          >
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            {copy.reviewBrowsePracticeSelected}
          </Link>
          <AddToListForm lists={lists} items={selected.map((h) => `kanji:${h}`)} returnTo={returnTo} compact />
        </div>
      ) : null}
    </div>
  );
}
