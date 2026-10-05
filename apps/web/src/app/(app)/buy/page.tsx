import { redirect } from 'next/navigation';
import { loadPurchaseData } from '@/lib/resources';
import { copy } from '@/lib/copy';
import type { PurchaseRow } from '@/lib/buy';
import type { Urgency } from '@roadmap/core';
import { setStatusAction, updateEtaAction, setOptedInAction } from './actions';

export const dynamic = 'force-dynamic';

const urgencyLabel: Record<Urgency, string> = {
  overdue: copy.buyUrgencyOverdue,
  due_soon: copy.buyUrgencyDueSoon,
  upcoming: copy.buyUrgencyUpcoming,
  later: copy.buyUrgencyLater,
};
const URGENCY_ORDER: Urgency[] = ['overdue', 'due_soon', 'upcoming', 'later'];

const statusLabel: Record<PurchaseRow['status'], string> = {
  none: copy.buyStatusNone,
  owned: copy.buyStatusOwned,
  ordered: copy.buyStatusOrdered,
  received: copy.buyStatusReceived,
  not_needed: copy.buyStatusNotNeeded,
};

function ResourceCard({ row }: { row: PurchaseRow }) {
  const lateRisk = row.purchase?.action === 'late_risk';
  const canBuyNow = row.purchase && ['overdue', 'due_soon', 'upcoming'].includes(row.purchase.urgency) && row.buyUrl;

  return (
    <li
      id={`resource-${row.id}`}
      className={`flex flex-col gap-2 rounded-md border p-3 ${lateRisk ? 'border-red-600' : 'border-line'}`}
    >
      <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
        <span className="min-w-0 text-sm font-medium break-words text-ink">{row.title}</span>
        <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted">{statusLabel[row.status]}</span>
      </div>

      {lateRisk ? <p className="text-xs font-medium text-red-600">{copy.buyLateRiskWarning}</p> : null}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-faint">
        <span>{copy.priceReferenceLabel(row.priceCheckedAt ?? '—')}</span>
        {row.purchase ? <span>{copy.buyNeedByLabel(row.purchase.needBy)}</span> : null}
        {row.purchase ? <span>{copy.buyOrderByLabel(row.purchase.orderBy)}</span> : null}
      </div>

      {row.freeAlternative ? <p className="text-xs text-ink-faint">{copy.buyFreeAlternativeLabel(row.freeAlternative)}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {canBuyNow ? (
          <a
            href={row.buyUrl!}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white"
          >
            {copy.buyBuyButton}
          </a>
        ) : null}
        {canBuyNow && row.isAffiliate ? <span className="text-xs text-ink-faint">{copy.buyAffiliateNote}</span> : null}

        {row.status === 'none' ? (
          <>
            <form action={setStatusAction}>
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="owned" />
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
                {copy.buyMarkOwned}
              </button>
            </form>
            <form action={setStatusAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="ordered" />
              <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
                {copy.buyEtaLabel}
                <input type="date" name="eta" required className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink" />
              </label>
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
                {copy.buyMarkOrdered}
              </button>
            </form>
            <form action={setStatusAction}>
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="not_needed" />
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
                {copy.buyMarkNotNeeded}
              </button>
            </form>
          </>
        ) : null}

        {row.status === 'ordered' ? (
          <>
            <form action={setStatusAction}>
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="received" />
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
                {copy.buyMarkReceived}
              </button>
            </form>
            <form action={updateEtaAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="resourceId" value={row.id} />
              <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
                {copy.buyEditEta}
                <input type="date" name="eta" required defaultValue={row.eta ?? undefined} className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink" />
              </label>
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
                {copy.buyEtaSubmit}
              </button>
            </form>
            <form action={setStatusAction}>
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="none" />
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink">
                {copy.buyCancelOrder}
              </button>
            </form>
          </>
        ) : null}
      </div>
    </li>
  );
}

export default async function BuyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error } = await searchParams;

  const data = await loadPurchaseData();
  if (!data) redirect('/create-plan');

  const coreRows = data.rows.filter((r) => r.tier === 'core');
  const optionalRows = data.rows.filter((r) => r.tier === 'optional');

  const byUrgency = new Map<Urgency, PurchaseRow[]>();
  const noActionRows: PurchaseRow[] = [];
  for (const r of coreRows) {
    if (r.purchase) {
      const list = byUrgency.get(r.purchase.urgency) ?? [];
      list.push(r);
      byUrgency.set(r.purchase.urgency, list);
    } else {
      noActionRows.push(r);
    }
  }

  const isActive = (r: PurchaseRow) => r.status !== 'not_needed';
  const relevant = data.rows.filter((r) => isActive(r) && (r.tier === 'core' || r.optedIn));
  const totalCore = relevant.filter((r) => r.tier === 'core').reduce((s, r) => s + r.priceVnd, 0);
  const totalOptional = relevant.filter((r) => r.tier === 'optional').reduce((s, r) => s + r.priceVnd, 0);
  const spent = relevant.filter((r) => r.status === 'owned' || r.status === 'ordered' || r.status === 'received').reduce((s, r) => s + r.priceVnd, 0);
  const remaining = totalCore + totalOptional - spent;

  const hasAnyRow = coreRows.length > 0 || optionalRows.length > 0;

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">{copy.buyTitle}</h1>

      {error ? <p className="rounded-md border border-red-600 p-3 text-sm text-red-600">{decodeURIComponent(error)}</p> : null}

      <section className="flex flex-col gap-1 rounded-md border border-line p-3 text-sm text-ink">
        <p className="font-medium">{copy.buyMonthlySpendTitle}</p>
        {Object.entries(data.monthlySpend)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, vnd]) => (
            <p key={month} className="text-ink-muted">
              {month}: {vnd.toLocaleString('vi-VN')}đ
            </p>
          ))}
        <p className="text-ink-muted">{copy.buyTotalsCore(totalCore)}</p>
        <p className="text-ink-muted">{copy.buyTotalsOptional(totalOptional)}</p>
        <p className="text-ink-muted">{copy.buySpentSoFar(spent)}</p>
        <p className="text-ink-muted">{copy.buyRemaining(remaining)}</p>
      </section>

      {!hasAnyRow ? <p className="text-sm text-ink-muted">{copy.buyEmptyState}</p> : null}

      {URGENCY_ORDER.map((u) => {
        const rows = byUrgency.get(u);
        if (!rows || rows.length === 0) return null;
        return (
          <section key={u} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink">{urgencyLabel[u]}</h2>
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <ResourceCard key={r.id} row={r} />
              ))}
            </ul>
          </section>
        );
      })}

      {noActionRows.length > 0 ? (
        <details className="rounded-md border border-line">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink">
            {copy.buyStatusOwned} / {copy.buyStatusNotNeeded} / {copy.buyStatusReceived}
          </summary>
          <ul className="flex flex-col gap-2 p-3 pt-0">
            {noActionRows.map((r) => (
              <ResourceCard key={r.id} row={r} />
            ))}
          </ul>
        </details>
      ) : null}

      {optionalRows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink">{copy.buyOptionalSectionTitle}</h2>
          <ul className="flex flex-col gap-2">
            {optionalRows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-md border border-line p-3">
                <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
                  <span className="min-w-0 text-sm font-medium break-words text-ink">{r.title}</span>
                  <form action={setOptedInAction}>
                    <input type="hidden" name="resourceId" value={r.id} />
                    <input type="hidden" name="optedIn" value={r.optedIn ? 'false' : 'true'} />
                    <button
                      type="submit"
                      className={`rounded-md border px-3 py-1.5 text-xs ${r.optedIn ? 'border-accent text-accent' : 'border-line text-ink'}`}
                    >
                      {copy.buyOptInToggle} {r.optedIn ? '✓' : ''}
                    </button>
                  </form>
                </div>
                {!r.optedIn ? <p className="text-xs text-ink-faint">{copy.buyOptOutNote}</p> : null}
                {r.optedIn ? <ResourceCard row={r} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
