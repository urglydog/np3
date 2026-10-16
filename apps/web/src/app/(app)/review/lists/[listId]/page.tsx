import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Dumbbell, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loadListDetail } from '@/lib/review-data';
import { deleteListAction, removeListItemAction } from '../../actions';
import { FlashMessage } from '@/components/review/flash-message';
import { ConfirmSubmit } from '@/components/review/confirm-submit';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function ReviewListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ listId }, { ok, error }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(listId)) notFound();
  const supabase = await createClient();
  const list = await loadListDetail(supabase, listId);
  if (!list) notFound();

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-4 p-4 pb-24 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <Link href="/review/lists" className="w-fit text-sm text-ink-muted">
          {copy.reviewBack}
        </Link>
        <h1 className="break-words text-2xl font-bold tracking-tight text-ink">{list.name}</h1>
        <p className="text-xs text-ink-muted">{copy.reviewListItemCount(list.items.length)}</p>
      </div>

      <FlashMessage ok={ok} error={error} />

      {list.items.length > 0 ? (
        <Link
          href={`/review/quiz/new?scope=list:${list.id}`}
          className="flex w-fit items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
        >
          <Dumbbell className="h-4 w-4" aria-hidden="true" />
          {copy.reviewListPractice}
        </Link>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">{copy.reviewListEmptyItems}</p>
      )}

      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface-raised">
        {list.items.map((i) => (
          <li key={`${i.item_type}:${i.item_id}`} className="flex items-center gap-3 px-3 py-2">
            {i.hex ? (
              <Link href={`/review/browse/${i.hex}`} className="flex min-w-0 flex-1 items-baseline gap-3">
                <span className="text-2xl text-ink" lang="ja">
                  {i.label}
                </span>
                <span className="truncate text-sm text-ink-muted">{i.sub}</span>
              </Link>
            ) : (
              <span className="flex min-w-0 flex-1 items-baseline gap-3">
                <span className="text-lg text-ink" lang="ja">
                  {i.label}
                </span>
                <span className="truncate text-sm text-ink-muted" lang="ja">
                  {i.sub}
                </span>
              </span>
            )}
            <form action={removeListItemAction}>
              <input type="hidden" name="listId" value={list.id} />
              <input type="hidden" name="itemType" value={i.item_type} />
              <input type="hidden" name="itemId" value={i.item_id} />
              <button
                type="submit"
                title={copy.reviewListRemoveItem}
                aria-label={copy.reviewListRemoveItem}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted active:bg-danger/10"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </li>
        ))}
      </ul>

      <form action={deleteListAction} className="mt-4">
        <input type="hidden" name="listId" value={list.id} />
        <ConfirmSubmit
          message={copy.reviewListDeleteConfirm}
          className="flex items-center gap-2 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {copy.reviewListDelete}
        </ConfirmSubmit>
      </form>
    </main>
  );
}
