import Link from 'next/link';
import { copy } from '@/lib/copy';

export const dynamic = 'force-static';

const sections = [
  { title: copy.reviewLicensesKanjidicTitle, body: copy.reviewLicensesKanjidicBody },
  { title: copy.reviewLicensesKanjivgTitle, body: copy.reviewLicensesKanjivgBody },
  { title: copy.reviewLicensesVnjpTitle, body: copy.reviewLicensesVnjpBody },
  { title: copy.reviewLicensesListOrderTitle, body: copy.reviewLicensesListOrderBody },
];

export default function ReviewLicensesPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 border-b border-line pb-4">
        <h1 className="pb-1 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand to-success">
          {copy.reviewLicensesTitle}
        </h1>
        <p className="text-sm text-ink-muted">{copy.reviewLicensesIntro}</p>
      </div>

      <section className="flex flex-col gap-4">
        {sections.map((s) => (
          <div key={s.title} className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-ink">{s.title}</h2>
            <p className="text-sm text-ink-muted">{s.body}</p>
          </div>
        ))}
      </section>

      <p className="rounded-xl border border-line bg-surface p-3 text-xs text-ink-faint">
        {copy.reviewLicensesDisclaimerFull}
      </p>

      <Link href="/review" className="text-sm text-ink-muted underline">
        {copy.reviewHomeTitle}
      </Link>
    </main>
  );
}
