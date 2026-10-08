import { redirect } from 'next/navigation';
import { CheckCircle2, CircleDot, Circle, XCircle } from 'lucide-react';
import { loadPurchaseData } from '@/lib/resources';
import { copy } from '@/lib/copy';
import type { PurchaseRow } from '@/lib/buy';
import type { Urgency } from '@roadmap/core';
import { setStatusAction, updateEtaAction, setOptedInAction } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { AnchorDetailsOpener } from '@/components/anchor-details-opener';

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

const statusIcon: Record<PurchaseRow['status'], React.ReactNode> = {
  none: <Circle size={20} className="text-ink-faint" />,
  ordered: <CircleDot size={20} className="text-brand" />,
  owned: <CheckCircle2 size={20} className="text-success" />,
  received: <CheckCircle2 size={20} className="text-success" />,
  not_needed: <XCircle size={20} className="text-ink-faint" />,
};

function ResourceCard({ row }: { row: PurchaseRow }) {
  const lateRisk = row.purchase?.action === 'late_risk';
  const canBuyNow = row.purchase && ['overdue', 'due_soon', 'upcoming'].includes(row.purchase.urgency) && row.buyUrl;

  return (
    <li
      id={`resource-${row.id}`}
      className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition-all bg-surface-raised ${
        lateRisk ? 'border-danger/50 shadow-danger/10' : 'border-line hover:border-brand/30'
      }`}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1">
        <span className="shrink-0 pt-0.5" aria-hidden="true">{statusIcon[row.status]}</span>
        <span className={`min-w-0 text-base font-semibold break-words ${row.status === 'owned' || row.status === 'received' ? 'text-ink-muted line-through' : 'text-ink'}`}>
          {row.title}
        </span>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
          row.status === 'owned' || row.status === 'received' ? 'bg-success/10 text-success border border-success/20' :
          row.status === 'ordered' ? 'bg-brand/10 text-brand border border-brand/20' :
          'bg-surface text-ink-muted border border-line'
        }`}>
          {statusLabel[row.status]}
        </span>
      </div>

      {lateRisk ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-danger bg-danger/10 p-2 rounded-lg border border-danger/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          {copy.buyLateRiskWarning}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-ink-muted border-b border-line/50 pb-3">
        <span className="flex items-center gap-1 text-ink">
          <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {copy.priceReferenceLabel(row.priceCheckedAt ?? '—')}
        </span>
        {row.purchase ? (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            {copy.buyNeedByLabel(row.purchase.needBy)}
          </span>
        ) : null}
        {row.purchase ? (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            {copy.buyOrderByLabel(row.purchase.orderBy)}
          </span>
        ) : null}
      </div>

      {row.freeAlternative ? <p className="text-xs text-brand italic bg-brand/5 p-2 rounded-lg">{copy.buyFreeAlternativeLabel(row.freeAlternative)}</p> : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {canBuyNow ? (
          <a
            href={row.buyUrl!}
            target="_blank"
            rel="noreferrer"
            className="btn-primary w-full sm:w-auto"
          >
            {copy.buyBuyButton}
          </a>
        ) : null}
        {canBuyNow && row.isAffiliate ? <span className="text-xs text-ink-faint w-full sm:w-auto">{copy.buyAffiliateNote}</span> : null}

        {row.status === 'none' ? (
          <>
            <form action={setStatusAction} className="flex-1 min-w-[120px]">
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="owned" />
              <SubmitButton className="btn-premium w-full text-success hover:border-success hover:bg-success/5">
                {copy.buyMarkOwned}
              </SubmitButton>
            </form>
            <form action={setStatusAction} className="flex flex-wrap items-end gap-2 w-full">
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="ordered" />
              <label className="flex flex-col gap-1 text-xs font-medium text-ink flex-1 min-w-[140px]">
                {copy.buyEtaLabel}
                <div className="flex gap-2">
                  <input type="date" name="eta" required className="input-premium py-1.5 px-2 flex-1" />
                  <SubmitButton className="btn-premium py-1.5 px-3 whitespace-nowrap">
                    {copy.buyMarkOrdered}
                  </SubmitButton>
                </div>
              </label>
            </form>
            <form action={setStatusAction} className="w-full sm:w-auto">
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="not_needed" />
              <SubmitButton className="text-xs text-ink-muted underline hover:text-ink px-2 py-1">
                {copy.buyMarkNotNeeded}
              </SubmitButton>
            </form>
          </>
        ) : null}

        {row.status === 'ordered' ? (
          <>
            <form action={setStatusAction} className="flex-1 min-w-[120px]">
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="received" />
              <SubmitButton className="btn-premium w-full text-brand hover:border-brand hover:bg-brand/5">
                {copy.buyMarkReceived}
              </SubmitButton>
            </form>
            <form action={updateEtaAction} className="flex flex-wrap items-end gap-2 w-full">
              <input type="hidden" name="resourceId" value={row.id} />
              <label className="flex flex-col gap-1 text-xs font-medium text-ink flex-1 min-w-[140px]">
                {copy.buyEditEta}
                <div className="flex gap-2">
                  <input type="date" name="eta" required defaultValue={row.eta ?? undefined} className="input-premium py-1.5 px-2 flex-1" />
                  <SubmitButton className="btn-premium py-1.5 px-3 whitespace-nowrap">
                    {copy.buyEtaSubmit}
                  </SubmitButton>
                </div>
              </label>
            </form>
            <form action={setStatusAction} className="w-full sm:w-auto mt-2">
              <input type="hidden" name="resourceId" value={row.id} />
              <input type="hidden" name="targetStatus" value="none" />
              <SubmitButton className="text-xs text-danger underline hover:text-danger/80 px-2 py-1">
                {copy.buyCancelOrder}
              </SubmitButton>
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
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-8 p-4 md:p-6 pb-24">
      <AnchorDetailsOpener />
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink bg-clip-text text-transparent bg-gradient-to-r from-brand to-accent">{copy.buyTitle}</h1>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger bg-danger/5 p-4 text-sm text-danger flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {decodeURIComponent(error)}
        </div>
      ) : null}

      <section className="glass rounded-2xl p-6 flex flex-col gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand to-accent"></div>
        <h2 className="text-lg font-bold text-ink">{copy.buyMonthlySpendTitle}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {Object.entries(data.monthlySpend)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, vnd]) => (
              <div key={month} className="flex flex-col p-3 bg-surface rounded-xl border border-line">
                <span className="text-ink-muted text-xs uppercase tracking-wider font-semibold">{month}</span>
                <span className="text-ink font-bold">{vnd.toLocaleString('vi-VN')}đ</span>
              </div>
            ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-2 border-t border-line/50 pt-4">
          <p className="flex flex-col"><span className="text-xs text-ink-muted uppercase font-semibold tracking-wider">Cốt lõi</span> <span className="font-medium text-ink">{totalCore.toLocaleString('vi-VN')}đ</span></p>
          <p className="flex flex-col"><span className="text-xs text-ink-muted uppercase font-semibold tracking-wider">Tùy chọn</span> <span className="font-medium text-ink">{totalOptional.toLocaleString('vi-VN')}đ</span></p>
          <p className="flex flex-col"><span className="text-xs text-ink-muted uppercase font-semibold tracking-wider">Đã chi</span> <span className="font-bold text-success">{spent.toLocaleString('vi-VN')}đ</span></p>
          <p className="flex flex-col"><span className="text-xs text-ink-muted uppercase font-semibold tracking-wider">Còn lại</span> <span className="font-bold text-brand">{remaining.toLocaleString('vi-VN')}đ</span></p>
        </div>
      </section>

      {!hasAnyRow ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-line rounded-2xl bg-surface-raised">
          <p className="text-ink-muted text-lg">{copy.buyEmptyState}</p>
        </div>
      ) : null}

      {URGENCY_ORDER.map((u) => {
        const rows = byUrgency.get(u);
        if (!rows || rows.length === 0) return null;
        return (
          <section key={u} className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                u === 'overdue' ? 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                u === 'due_soon' ? 'bg-warning' :
                u === 'upcoming' ? 'bg-brand' : 'bg-ink-muted'
              }`}></span>
              {urgencyLabel[u]}
            </h2>
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <ResourceCard key={r.id} row={r} />
              ))}
            </ul>
          </section>
        );
      })}

      {noActionRows.length > 0 ? (
        <details className="group rounded-2xl border border-line bg-surface shadow-sm overflow-hidden transition-all open:ring-1 open:ring-line">
          <summary className="flex cursor-pointer items-center justify-between bg-surface-raised px-5 py-4 text-lg font-bold text-ink hover:bg-line/50 transition-colors select-none">
            {copy.buyStatusOwned} / {copy.buyStatusNotNeeded} / {copy.buyStatusReceived}
            <span className="text-ink-faint transition-transform group-open:rotate-180">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </span>
          </summary>
          <ul className="flex flex-col gap-3 p-5 bg-surface/50 border-t border-line">
            {noActionRows.map((r) => (
              <ResourceCard key={r.id} row={r} />
            ))}
          </ul>
        </details>
      ) : null}

      {optionalRows.length > 0 ? (
        <section className="flex flex-col gap-3 mt-4">
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {copy.buyOptionalSectionTitle}
          </h2>
          <ul className="flex flex-col gap-4">
            {optionalRows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-5 shadow-sm transition-all hover:border-brand/30">
                <div className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1">
                  <span className="min-w-0 text-base font-semibold break-words text-ink">{r.title}</span>
                  <form action={setOptedInAction}>
                    <input type="hidden" name="resourceId" value={r.id} />
                    <input type="hidden" name="optedIn" value={r.optedIn ? 'false' : 'true'} />
                    <SubmitButton
                      className={`btn-premium py-1.5 px-3 text-xs w-[120px] justify-between ${r.optedIn ? 'border-brand text-brand bg-brand/5 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]' : 'border-line text-ink'}`}
                    >
                      {copy.buyOptInToggle}
                      {r.optedIn ? (
                        <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      ) : (
                        <span className="w-4 h-4"></span>
                      )}
                    </SubmitButton>
                  </form>
                </div>
                {!r.optedIn ? <p className="text-sm text-ink-muted italic border-l-2 border-line pl-3 py-1">{copy.buyOptOutNote}</p> : null}
                {r.optedIn ? <div className="mt-2"><ResourceCard row={r} /></div> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
