import { redirect } from 'next/navigation';
import Link from 'next/link';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { loadPurchaseData } from '@/lib/resources';
import { buildUpcomingList } from '@/lib/upcoming';
import { copy } from '@/lib/copy';

export const dynamic = 'force-dynamic';

export default async function UpcomingPage() {
  const plan = await loadCurrentPlanSchedule();
  if (!plan) redirect('/create-plan');
  const purchaseData = await loadPurchaseData();

  const taskNameById = new Map([...plan.taskInfoById.entries()].map(([id, info]) => [id, info.name]));
  const list = buildUpcomingList(plan.schedule.tasks, taskNameById, purchaseData?.rows ?? [], plan.today);

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">{copy.upcomingTitle}</h1>
      <p className="text-xs text-ink-faint">{copy.upcomingHorizonLabel}</p>

      {list.length === 0 ? (
        <p className="text-sm text-ink-muted">{copy.upcomingEmptyState}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((entry) => (
            <li key={`${entry.type}-${entry.id}`} className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 rounded-md border border-line p-3">
              <span className="min-w-0 text-sm font-medium break-words text-ink">
                {entry.type === 'task' ? (
                  <Link href={`/roadmap#task-${entry.id}`} className="underline">
                    {entry.title}
                  </Link>
                ) : (
                  <Link href={`/buy#resource-${entry.id}`} className="underline">
                    {entry.title}
                  </Link>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted">
                {entry.type === 'task' ? copy.upcomingTaskStartLabel(entry.date) : copy.upcomingPurchaseOrderByLabel(entry.date)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ink-faint">{copy.hoursEstimateDisclaimer}</p>
    </main>
  );
}
