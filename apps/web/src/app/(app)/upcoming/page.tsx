import { redirect } from 'next/navigation';
import Link from 'next/link';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { loadPurchaseData } from '@/lib/resources';
import { buildUpcomingList } from '@/lib/upcoming';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

const urgencyColor: Record<string, string> = {
  overdue:  'bg-danger/10 text-danger border-danger/30',
  due_soon: 'bg-warning/10 text-warning border-warning/30',
  upcoming: 'bg-brand/10 text-brand border-brand/30',
  later:    'bg-surface text-ink-muted border-line',
};

type Tab = 'all' | 'task' | 'purchase';

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === 'task' || rawTab === 'purchase' ? rawTab : 'all';

  const [plan, purchaseData] = await Promise.all([loadCurrentPlanSchedule(), loadPurchaseData()]);
  if (!plan) redirect('/create-plan');

  const taskNameById = new Map([...plan.taskInfoById.entries()].map(([id, info]) => [id, info.name]));
  // Mở rộng horizon 30 ngày để hiện task sắp tới dài hơn 14 ngày
  const fullList = buildUpcomingList(plan.schedule.tasks, taskNameById, purchaseData?.rows ?? [], plan.today, 30);
  const taskCount = fullList.filter((e) => e.type === 'task').length;
  const purchaseCount = fullList.filter((e) => e.type === 'purchase').length;
  const list = tab === 'all' ? fullList : fullList.filter((e) => e.type === tab);

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: 'all', label: copy.upcomingTabAll, count: fullList.length },
    { value: 'task', label: copy.upcomingTabTask, count: taskCount },
    { value: 'purchase', label: copy.upcomingTabPurchase, count: purchaseCount },
  ];

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-4">
        <h1 className="pb-1 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand to-success">
          {copy.upcomingTitle}
        </h1>
        <p className="text-sm text-ink-muted">30 ngày tới</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value === 'all' ? '/upcoming' : `/upcoming?tab=${t.value}`}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value ? 'border-brand bg-brand/10 text-brand' : 'border-line text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
            {t.count > 0 ? (
              <span className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === t.value ? 'bg-brand text-white' : 'bg-line text-ink-muted'
              }`}>
                {t.count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line bg-surface-raised p-12 text-center">
          <span className="text-5xl">🎯</span>
          <div>
            <p className="text-lg font-semibold text-ink">Không có gì trong 30 ngày tới</p>
            <p className="mt-1 text-sm text-ink-muted">
              Task tiếp theo của bạn có thể bắt đầu sau hơn 30 ngày nữa.{' '}
              <Link href="/roadmap" className="text-brand underline">Xem toàn bộ lộ trình →</Link>
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((entry) => (
            <li
              key={`${entry.type}-${entry.id}`}
              className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface-raised p-4 shadow-sm transition-all hover:border-brand/30"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint mb-0.5">
                  {entry.type === 'task' ? (
                    <><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Task học</>
                  ) : (
                    <><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg> Cần mua</>
                  )}
                </span>
                {entry.type === 'task' ? (
                  <Link href={`/roadmap#task-${entry.id}`} className="text-base font-semibold text-brand hover:underline break-words">
                    {entry.title}
                  </Link>
                ) : (
                  <Link href={`/buy#resource-${entry.id}`} className="text-base font-semibold text-ink hover:text-brand hover:underline break-words">
                    {entry.title}
                  </Link>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-xs font-semibold text-ink-muted whitespace-nowrap bg-surface px-2 py-1 rounded-lg border border-line">
                  {entry.date}
                </span>
                {entry.type === 'purchase' && (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${urgencyColor[entry.urgency] ?? ''}`}>
                    {entry.urgency.replace('_', ' ')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ink-faint mt-4 text-center">{copy.hoursEstimateDisclaimer}</p>
    </main>
  );
}
