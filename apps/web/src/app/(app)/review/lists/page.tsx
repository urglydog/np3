import { redirect } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import { loadReviewListsWithItems } from '@/lib/review-data';
import { createListAction, deleteListAction, removeListItemAction } from './actions';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

export default async function ReviewListsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const lists = await loadReviewListsWithItems();
  if (lists === null) redirect('/login');

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{copy.reviewListsLink}</h1>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger bg-danger/5 p-4 text-sm text-danger">{decodeURIComponent(error)}</div>
      ) : null}
      {ok === '1' ? (
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-success">{copy.reviewListsActionSuccess}</div>
      ) : null}

      {/* Tạo list mới */}
      <form action={createListAction} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised p-4">
        <label htmlFor="new-list-name" className="text-sm font-medium text-ink-muted">
          {copy.reviewListsCreateLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="new-list-name"
            name="name"
            type="text"
            required
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
          <button type="submit" className="btn-primary text-sm">
            {copy.reviewListsCreateSubmit}
          </button>
        </div>
      </form>

      {lists.length === 0 ? (
        <p className="text-sm text-ink-muted">{copy.reviewListsEmptyState}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {lists.map((list) => (
            <section key={list.id} className="rounded-2xl border border-line bg-surface-raised p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">{list.name}</h2>
                  <p className="text-xs text-ink-muted">{copy.reviewListsItemCount(list.itemCount)}</p>
                </div>
                <form action={deleteListAction}>
                  <input type="hidden" name="listId" value={list.id} />
                  <button type="submit" className="btn-premium text-xs text-danger" title={copy.reviewListsDeleteList}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
              {list.items.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {list.items.map((item) => (
                    <li
                      key={`${item.itemType}-${item.itemId}`}
                      className="flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink"
                    >
                      {item.label}
                      <form action={removeListItemAction}>
                        <input type="hidden" name="listId" value={list.id} />
                        <input type="hidden" name="itemType" value={item.itemType} />
                        <input type="hidden" name="itemId" value={item.itemId} />
                        <button type="submit" title={copy.reviewListsRemoveItem} className="text-ink-faint hover:text-danger">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-faint">{copy.reviewListsEmptyState}</p>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
