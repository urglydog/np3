import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loadLists } from '@/lib/review-data';
import { createListAction } from '../actions';
import { SubmitButton } from '@/components/submit-button';
import { FlashMessage } from '@/components/review/flash-message';
import { ListsMultiSelect } from '@/components/review/lists-multi-select';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

export default async function ReviewListsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const lists = await loadLists(supabase);

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-4 p-4 pb-24 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <Link href="/review" className="w-fit text-sm text-ink-muted">
          {copy.reviewBack}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{copy.reviewListsTitle}</h1>
      </div>

      <FlashMessage ok={ok} error={error} />

      <form action={createListAction} className="flex gap-2">
        <input
          name="name"
          required
          maxLength={100}
          placeholder={copy.reviewListNamePlaceholder}
          aria-label={copy.reviewListNameLabel}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-raised px-3 py-2 text-base text-ink"
        />
        <SubmitButton className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-hover">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {copy.reviewListCreate}
        </SubmitButton>
      </form>

      {lists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">{copy.reviewListsEmpty}</p>
      ) : (
        <ListsMultiSelect lists={lists} />
      )}
    </main>
  );
}
