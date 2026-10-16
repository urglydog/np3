'use client';

import { useState } from 'react';
import { ListPlus } from 'lucide-react';
import { addToListAction } from '@/app/(app)/review/actions';
import { SubmitButton } from '@/components/submit-button';
import { copy } from '@/lib/copy';

/**
 * Form "Thêm vào danh sách": chọn danh sách có sẵn hoặc tạo mới ngay tại chỗ.
 * items dạng "kanji:<hex>" | "example:<uuid>".
 */
export function AddToListForm({
  lists,
  items,
  returnTo,
  compact = false,
}: {
  lists: { id: string; name: string }[];
  items: string[];
  returnTo: string;
  compact?: boolean;
}) {
  const [target, setTarget] = useState(lists[0]?.id ?? '__new');
  return (
    <form action={addToListAction} className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'rounded-xl border border-line bg-surface-raised p-3'}`}>
      {items.map((i) => (
        <input key={i} type="hidden" name="item" value={i} />
      ))}
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="sr-only" htmlFor="add-to-list-target">
        {copy.reviewAddToListChoose}
      </label>
      <select
        id="add-to-list-target"
        name="listId"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-2 text-base text-ink"
      >
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
        <option value="__new">{copy.reviewAddToListNew}</option>
      </select>
      {target === '__new' ? (
        <input
          name="newListName"
          required
          maxLength={100}
          placeholder={copy.reviewListNamePlaceholder}
          aria-label={copy.reviewListNameLabel}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-2 text-base text-ink"
        />
      ) : null}
      <SubmitButton className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
        <ListPlus className="h-4 w-4" aria-hidden="true" />
        {copy.reviewAddToList}
      </SubmitButton>
    </form>
  );
}
