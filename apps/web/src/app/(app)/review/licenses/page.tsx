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
        <h2 className="font-semibold">Nghĩa, âm On/Kun, số nét, âm Hán Việt (một phần)</h2>
        <p>
          Lấy từ tệp KANJIDIC2, © Electronic Dictionary Research and Development Group (EDRDG), dùng theo giấy phép Creative Commons
          Attribution-ShareAlike. Một số âm Hán Việt đã được dự án chỉnh sửa lại và đang chờ người học tiếng Việt kiểm chứng. Xem{' '}
          <a className={ext} href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noopener noreferrer">
            giấy phép EDRDG
          </a>{' '}
          và{' '}
          <a className={ext} href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noopener noreferrer">
            dự án KANJIDIC
          </a>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Hình thứ tự nét</h2>
        <p>
          KanjiVG © 2009–2026 Ulrich Apel, giấy phép Creative Commons Attribution-ShareAlike 3.0 (
          <a className={ext} href="https://kanjivg.tagaini.net/" target="_blank" rel="noopener noreferrer">
            kanjivg.tagaini.net
          </a>
          ). Hình đã được tô màu theo nét bằng kịch bản{' '}
          <a className={ext} href="https://github.com/cayennes/kanji-colorize" target="_blank" rel="noopener noreferrer">
            kanji_colorize.py
          </a>
          . Mỗi tệp SVG giữ nguyên phần ghi bản quyền gốc.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Danh sách 512 chữ và thứ tự bài</h2>
        <p>
          Theo giáo trình <em>Kanji Look and Learn</em> (The Japan Times). App không chứa hình minh hoạ, lời gợi nhớ hay nội dung giải thích của
          giáo trình — hãy dùng sách gốc để học.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Nghĩa tiếng Việt và ví dụ</h2>
        <p>
          Do tác giả tự tổng hợp trong lúc học, tham khảo app VNJP (© VNJPCLUB) và giáo trình trên, chỉ để tự ôn. Có thể có sai sót; các mục đang
          chờ xác nhận được đánh dấu và chưa dùng trong bài luyện.
        </p>
      </section>

      <p className="text-xs text-ink-muted">
        Các nguồn KANJIDIC2 và KanjiVG dùng giấy phép CC BY-SA nên dữ liệu dẫn xuất trong app cũng được chia sẻ theo cùng điều kiện và ghi công như
        trên.
      </p>
    </main>
  );
}
