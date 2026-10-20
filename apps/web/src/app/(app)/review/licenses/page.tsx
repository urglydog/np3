import Link from 'next/link';
import { copy } from '@/lib/copy';

// Rút gọn từ data/review/kanji-look-and-learn-512/ATTRIBUTION.md — sửa nguồn ghi công thì sửa cả hai nơi.
const ext = 'text-brand underline break-words';

export default function ReviewLicensesPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-5 p-4 pb-24 text-sm leading-relaxed text-ink md:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <Link href="/review" className="w-fit text-sm text-ink-muted">
          {copy.reviewBack}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{copy.reviewLicensesTitle}</h1>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{copy.reviewLicensesKanjidicTitle}</h2>
        <p>
          {copy.reviewLicensesKanjidicBodyPrefix}
          <a className={ext} href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noopener noreferrer">
            {copy.reviewLicensesEdrdgLicenseLink}
          </a>
          {copy.reviewLicensesKanjidicBodyMid}
          <a className={ext} href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noopener noreferrer">
            {copy.reviewLicensesKanjidicProjectLink}
          </a>
          {copy.reviewLicensesKanjidicBodySuffix}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{copy.reviewLicensesStrokeOrderTitle}</h2>
        <p>
          {copy.reviewLicensesStrokeOrderBodyPrefix}
          <a className={ext} href="https://kanjivg.tagaini.net/" target="_blank" rel="noopener noreferrer">
            {copy.reviewLicensesKanjivgLink}
          </a>
          {copy.reviewLicensesStrokeOrderBodyMid}
          <a className={ext} href="https://github.com/cayennes/kanji-colorize" target="_blank" rel="noopener noreferrer">
            {copy.reviewLicensesColorizeScriptLink}
          </a>
          {copy.reviewLicensesStrokeOrderBodySuffix}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{copy.reviewLicensesListTitle}</h2>
        <p>{copy.reviewLicensesListBody}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{copy.reviewLicensesVietnameseTitle}</h2>
        <p>{copy.reviewLicensesVietnameseBody}</p>
      </section>

      <p className="text-xs text-ink-muted">{copy.reviewLicensesFooter}</p>
    </main>
  );
}
