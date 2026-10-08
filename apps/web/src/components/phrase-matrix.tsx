import Link from 'next/link';
import type { PhraseMatrixGroup } from '@/lib/roadmap';

const cellClass: Record<string, string> = {
  done: 'bg-success/15 text-success border-success/30',
  in_progress: 'bg-brand text-white border-brand',
  todo: 'bg-surface text-ink-muted border-line',
  skipped: 'bg-surface text-ink-faint border-line opacity-40',
};

export function PhraseMatrix({ groups }: { groups: PhraseMatrixGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-4">
      {groups.map((g) => (
        <div key={g.milestone} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{g.milestone}</h3>
          <div className="grid grid-cols-5 gap-1.5">
            {g.items.map((item) => (
              <Link
                key={item.id}
                href={`/task/${item.id}`}
                title={`${g.milestone} #${item.index}`}
                className={`flex aspect-square items-center justify-center rounded-md border text-xs font-semibold transition-transform active:scale-95 ${cellClass[item.status]}`}
              >
                {item.index}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
