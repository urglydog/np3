import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Dumbbell } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loadKanjiDetail, loadLists } from '@/lib/review-data';
import { AddToListForm } from '@/components/review/add-to-list-form';
import { FlashMessage } from '@/components/review/flash-message';
import { WritingPad } from '@/components/review/writing-pad';
import { BackLink } from '@/components/back-link';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

export default async function KanjiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ hex: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ hex }, { ok, error }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{4,6}$/.test(hex)) notFound();
  const supabase = await createClient();
  const [k, lists] = await Promise.all([loadKanjiDetail(supabase, hex), loadLists(supabase)]);
  if (!k) notFound();
  const pending = !k.confirmed_at;

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-5 p-4 pb-24 md:p-6">
      <BackLink label={copy.reviewBack} />
      <FlashMessage ok={ok} error={error} />

      <section className="flex items-start gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-raised text-7xl text-ink" lang="ja">
          {k.kanji}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs text-ink-muted">{copy.reviewLessonLabel(k.vnjp_lesson ?? 0)}</p>
          <p className="text-2xl font-bold text-ink">{k.han_viet_main ?? '—'}</p>
          {k.han_viet_accepted.length > 0 ? (
            <p className="text-xs text-ink-muted">{copy.reviewDetailHanVietAccepted(k.han_viet_accepted.join(', '))}</p>
          ) : null}
          {k.meaning_vi ? <p className="text-sm text-ink">{k.meaning_vi}</p> : null}
          {pending ? (
            <span className="w-fit rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-ink" title={copy.reviewPendingBadgeTitle}>
              {copy.reviewPendingBadge}
            </span>
          ) : null}
        </div>
      </section>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-line bg-surface-raised p-3 text-sm">
        <dt className="text-ink-muted">{copy.reviewDetailOnyomi}</dt>
        <dd className="text-ink" lang="ja">
          {k.onyomi.join('、') || '—'}
        </dd>
        <dt className="text-ink-muted">{copy.reviewDetailKunyomi}</dt>
        <dd className="text-ink" lang="ja">
          {k.kunyomi.join('、') || '—'}
        </dd>
        <dt className="text-ink-muted">{copy.reviewDetailMeaningEn}</dt>
        <dd className="text-ink">{k.meaning_en ?? '—'}</dd>
        {k.stroke_count ? (
          <>
            <dt className="text-ink-muted">{copy.reviewDetailStrokeOrder}</dt>
            <dd className="text-ink">{copy.reviewDetailStrokes(k.stroke_count)}</dd>
          </>
        ) : null}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewDetailProgress}</h2>
        <div className="grid grid-cols-2 gap-2">
          {(['K1', 'K2'] as const).map((q) => {
            const s = k.states[q];
            return (
              <div key={q} className="rounded-xl border border-line bg-surface-raised p-3">
                <p className="text-xs text-ink-muted">{copy.reviewQuestionTypeLabel[q]}</p>
                <p className="font-semibold text-ink">{copy.reviewMasteryLabel[s?.mastery_level ?? 'new']}</p>
                {s ? <p className="text-[11px] text-ink-muted">{copy.reviewStatsLine(s.correct_count, s.wrong_count, s.streak)}</p> : null}
              </div>
            );
          })}
        </div>
        {!pending ? (
          <Link
            href={`/review/quiz/new?scope=kanji:${k.unicode_hex}`}
            className="flex w-fit items-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand"
          >
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            {copy.reviewDetailPractice}
          </Link>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewDetailStrokeOrder}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh tự host, không cần tối ưu ảnh; tránh inline SVG */}
        <img
          src={k.svg_path}
          alt={copy.reviewDetailStrokeOrderAlt(k.kanji)}
          width={220}
          height={220}
          className="mx-auto h-[220px] w-[220px] rounded-xl border border-line bg-surface-raised"
        />
        <p className="text-center text-[11px] text-ink-muted">
          {copy.reviewDetailAttribution} ·{' '}
          <Link href="/review/licenses" className="underline">
            {copy.reviewLicensesLink}
          </Link>
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewDetailWritingPad}</h2>
        <WritingPad kanji={k.kanji} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewDetailExamples(k.examples.length)}</h2>
        {k.examples.length === 0 ? (
          <p className="text-sm text-ink-muted">{copy.reviewDetailNoExamples}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface-raised">
            {k.examples.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 px-3 py-2">
                <span className="shrink-0 text-lg text-ink" lang="ja">
                  {e.term}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs text-ink-muted" lang="ja">
                    {e.reading_kana}
                  </span>
                  <span className="text-sm text-ink">{e.meaning_vi}</span>
                </span>
                {!e.confirmed_at ? (
                  <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-warning" title={copy.reviewPendingBadgeTitle} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{copy.reviewAddToList}</h2>
        <AddToListForm
          lists={lists.map((l) => ({ id: l.id, name: l.name }))}
          items={[`kanji:${k.unicode_hex}`]}
          returnTo={`/review/browse/${k.unicode_hex}`}
        />
      </section>
    </main>
  );
}
