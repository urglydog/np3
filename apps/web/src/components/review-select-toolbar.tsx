'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { copy } from '@/lib/copy';
import { addItemsToListAction } from '@/app/(app)/review/lists/actions';

export interface BrowseTile {
  hex: string;
  id: string;
  kanji: string;
  hanVietMain: string | null;
}

export interface ListOption {
  id: string;
  name: string;
}

/**
 * Lưới kanji của 1 bài + chế độ "Select" chọn nhiều ô, giữ Set các unicode_hex đã chọn trong state.
 * Gộp lưới và nút Select vào 1 component client (thay vì tile Server Component riêng) vì việc chọn
 * nhiều ô cần state chia sẻ giữa các tile — quyết định kỹ thuật ở M3, không đổi dữ liệu/route.
 */
export function ReviewSelectToolbar({ tiles, lists }: { tiles: BrowseTile[]; lists: ListOption[] }) {
  const [selecting, setSelecting] = useState(false);
  const [selectedHex, setSelectedHex] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [listChoice, setListChoice] = useState('');
  const [newListName, setNewListName] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleSelecting() {
    setSelecting((s) => !s);
    setSelectedHex(new Set());
    setSheetOpen(false);
    setMessage(null);
  }

  function toggleTile(hex: string) {
    setSelectedHex((prev) => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex);
      else next.add(hex);
      return next;
    });
  }

  async function handleAdd() {
    setPending(true);
    setMessage(null);
    const itemIds = tiles.filter((t) => selectedHex.has(t.hex)).map((t) => t.id);
    const formData = new FormData();
    formData.set('itemIds', JSON.stringify(itemIds));
    formData.set('itemType', 'kanji');
    formData.set('listId', listChoice);
    formData.set('newListName', newListName);
    const result = await addItemsToListAction(formData);
    setPending(false);
    if (result.ok) {
      setSheetOpen(false);
      setSelecting(false);
      setSelectedHex(new Set());
      setListChoice('');
      setNewListName('');
    } else {
      setMessage(result.message ?? 'Có lỗi xảy ra.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={toggleSelecting} className="btn-premium text-sm">
          {selecting ? copy.reviewBrowseSelectCancel : copy.reviewBrowseSelectToggle}
        </button>
        {selecting ? <span className="text-sm text-ink-muted">{copy.reviewBrowseSelectedCount(selectedHex.size)}</span> : null}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {tiles.map((t) => {
          const isSelected = selectedHex.has(t.hex);
          const content = (
            <>
              <span className="text-2xl">{t.kanji}</span>
              <span className="w-full truncate text-center text-[10px] text-ink-muted">{t.hanVietMain ?? '—'}</span>
            </>
          );
          if (selecting) {
            return (
              <button
                key={t.hex}
                type="button"
                onClick={() => toggleTile(t.hex)}
                className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-2 ${
                  isSelected ? 'border-brand bg-brand/10' : 'border-line bg-surface-raised'
                }`}
              >
                {isSelected ? (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : null}
                {content}
              </button>
            );
          }
          return (
            <Link
              key={t.hex}
              href={`/review/browse/${t.hex}`}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-raised p-2"
            >
              {content}
            </Link>
          );
        })}
      </div>

      {selecting && selectedHex.size > 0 && !sheetOpen ? (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto flex w-full max-w-screen-md justify-center px-4">
          <button type="button" onClick={() => setSheetOpen(true)} className="btn-primary w-full shadow-lg">
            {copy.reviewBrowseAddToList}
          </button>
        </div>
      ) : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={() => setSheetOpen(false)}>
          <div
            className="w-full max-w-screen-sm rounded-t-2xl border border-line bg-surface-raised p-4 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-base font-semibold text-ink">{copy.reviewBrowseAddToList}</h2>
            {lists.length > 0 ? (
              <div className="mb-3 flex flex-col gap-2">
                {lists.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="list-choice"
                      checked={listChoice === l.id}
                      onChange={() => {
                        setListChoice(l.id);
                        setNewListName('');
                      }}
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            ) : null}
            <label className="mb-1 block text-sm text-ink-muted" htmlFor="new-list-name-sheet">
              {copy.reviewListsCreateLabel}
            </label>
            <input
              id="new-list-name-sheet"
              type="text"
              value={newListName}
              onChange={(e) => {
                setNewListName(e.target.value);
                setListChoice('');
              }}
              className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
            {message ? <p className="mb-2 text-sm text-danger">{message}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setSheetOpen(false)} className="btn-premium flex-1 text-sm">
                {copy.reviewBrowseCancel}
              </button>
              <button type="button" disabled={pending} onClick={handleAdd} className="btn-primary flex-1 text-sm">
                {pending ? '...' : copy.reviewBrowseAddToList}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
