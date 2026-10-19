// Sinh SQL nạp dữ liệu module "Ôn luyện" (Kanji 512, đợt 1 = bài 1-12) từ dữ liệu nguồn tĩnh trong
// data/review/kanji-look-and-learn-512/ + SVG đã copy vào apps/web/public/kanjivg/.
//
// Theo convention scripts/gen-seed.ts: đọc dữ liệu nguồn trong repo, SINH 1 FILE SQL
// (supabase/seed_review.sql), KHÔNG tự kết nối Supabase, KHÔNG đọc .env. Khác gen-seed.ts ở việc dùng
// "insert ... on conflict do update/do nothing" để IDEMPOTENT (chạy lại nhiều lần không tạo trùng),
// vì module review nạp theo đợt (bài 13-32 sẽ nạp sau bằng cách chạy lại script này với dữ liệu mới).
//
// Cách chạy (ở máy có Node/Supabase local, KHÔNG chạy ở máy chủ này theo luật CLAUDE.md):
//   tsx scripts/seed-review.ts
//   # rồi áp SQL sinh ra vào Supabase local (giống cách chạy scripts/rls_test.sql):
//   docker exec -i supabase_db_np3 psql -U postgres -d postgres < supabase/seed_review.sql
// Không cần biến môi trường nào — script chỉ đọc file tĩnh + ghi file SQL, không gọi network/service role.
//
// Giới hạn & giả định (đọc trước khi tin kết quả):
// - Phạm vi đợt 1 CỐ ĐỊNH ở lesson<=12 (192 kanji) theo quyết định 2.1.2 của plan — lọc ngay khi đọc
//   kanji_512.csv (512 dòng gốc), KHÔNG cần file CSV trung gian đã lọc sẵn.
// - stroke_points: parser SVG path ở hàm parseSvgStrokePoints() chỉ hỗ trợ lệnh M/L/C/Q/Z (đủ cho
//   KanjiVG dùng M + C), resample mỗi nét về ~16 điểm đều theo tham số t (KHÔNG phải đều theo độ dài
//   cung thật — xấp xỉ đủ dùng cho scoreHandwriting heuristic phía client, không dùng cho mục đích
//   chính xác hình học khác). Không parse transform/viewBox phức tạp — toạ độ giữ nguyên hệ toạ độ gốc
//   của file KanjiVG (0..109 theo quy ước kanji_colorize), FE tự chuẩn hoá khi so khớp.
// - Số liệu in ra cuối (kanji/ví dụ/needs_review/lệch Hán Việt) là SỐ THẬT tính từ dữ liệu lúc chạy,
//   không suy đoán trước — nếu khác số trong docs/plans/review-feature.plan.md, tin số script in ra.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'data/review/kanji-look-and-learn-512');
const svgDir = join(root, 'apps/web/public/kanjivg');

const LESSON_CUTOFF = 12; // đợt 1 — xem quyết định 2.1.2

// ============ 1. CSV parser (RFC4180 cơ bản: dấu ngoặc kép, dấu phẩy trong giá trị) ============
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = stripBom(text).replace(/\r\n/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    return obj;
  });
}

function splitPipe(value: string): string[] {
  return value
    .split('|')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// ============ 2. Parser SVG path -> StrokePoint[] (giới hạn ở comment đầu file) ============
interface StrokePoint {
  x: number;
  y: number;
}

/**
 * Parse thuộc tính "d" của 1 <path> KanjiVG thành danh sách điểm đã resample đều theo tham số t.
 * Hỗ trợ lệnh M, L, C, Q, Z (đủ cho toàn bộ path KanjiVG quan sát được — thực tế chỉ dùng M+C).
 * KHÔNG resample theo độ dài cung thật (chỉ theo tỉ lệ số đoạn lệnh) — xấp xỉ đủ cho heuristic
 * scoreHandwriting ở client, không dùng cho mục đích đo đạc hình học chính xác.
 */
function parseSvgPathToPoints(d: string, samplesPerStroke = 16): StrokePoint[] {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let i = 0;
  let cur: StrokePoint = { x: 0, y: 0 };
  const segments: { eval: (t: number) => StrokePoint }[] = [];

  const readNum = (): number => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') {
      const x = readNum();
      const y = readNum();
      cur = { x, y };
    } else if (cmd === 'L') {
      const x = readNum();
      const y = readNum();
      const from = cur;
      segments.push({ eval: (t) => ({ x: from.x + (x - from.x) * t, y: from.y + (y - from.y) * t }) });
      cur = { x, y };
    } else if (cmd === 'C') {
      const x1 = readNum();
      const y1 = readNum();
      const x2 = readNum();
      const y2 = readNum();
      const x = readNum();
      const y = readNum();
      const p0 = cur;
      segments.push({
        eval: (t) => {
          const mt = 1 - t;
          return {
            x: mt * mt * mt * p0.x + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x,
            y: mt * mt * mt * p0.y + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y,
          };
        },
      });
      cur = { x, y };
    } else if (cmd === 'Q') {
      const x1 = readNum();
      const y1 = readNum();
      const x = readNum();
      const y = readNum();
      const p0 = cur;
      segments.push({
        eval: (t) => {
          const mt = 1 - t;
          return {
            x: mt * mt * p0.x + 2 * mt * t * x1 + t * t * x,
            y: mt * mt * p0.y + 2 * mt * t * y1 + t * t * y,
          };
        },
      });
      cur = { x, y };
    } else if (cmd === 'Z') {
      // nét KanjiVG không đóng vòng thực tế — bỏ qua, không có toạ độ mới
    } else {
      // token số bị lạc (không theo sau lệnh hợp lệ) — bỏ qua, không chặn parse toàn path
    }
  }

  if (segments.length === 0) {
    return [cur];
  }

  const points: StrokePoint[] = [];
  for (let s = 0; s < samplesPerStroke; s++) {
    const t = samplesPerStroke === 1 ? 0 : s / (samplesPerStroke - 1);
    const segIndex = Math.min(segments.length - 1, Math.floor(t * segments.length));
    const localT = t * segments.length - segIndex;
    points.push(segments[segIndex].eval(Math.min(1, Math.max(0, localT))));
  }
  return points;
}

function parseKanjiVgStrokePoints(svgText: string): StrokePoint[][] {
  const pathMatches = svgText.match(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g) ?? [];
  return pathMatches.map((tag) => {
    const dMatch = tag.match(/\bd="([^"]+)"/);
    return parseSvgPathToPoints(dMatch ? dMatch[1] : '');
  });
}

// ============ 3. SQL literal helpers (theo convention gen-seed.ts) ============
const sqlStr = (v: string | null | undefined): string => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const sqlBool = (v: boolean): string => (v ? 'true' : 'false');
const sqlNum = (v: number | null): string => (v == null || Number.isNaN(v) ? 'null' : String(v));
const sqlTextArray = (arr: string[]): string =>
  arr.length === 0 ? "'{}'" : `array[${arr.map(sqlStr).join(',')}]`;
const sqlJsonb = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

// ============ 4. Đọc dữ liệu nguồn ============
interface KanjiDeckRow {
  lesson: number;
  orderInLesson: number;
  kanji: string;
  unicodeHex: string;
  isKanji: boolean;
  hanVietMain: string;
  hanVietAccepted: string[];
  hanVietOther: string[];
  meaningEn: string;
  note: string;
  onyomi: string[];
  kunyomi: string[];
  strokeCount: number | null;
  needsReview: boolean;
  reviewNote: string;
}

const kanjiDeckRaw = parseCsvObjects(readFileSync(join(dataDir, 'kanji_512.csv'), 'utf8'));
const kanjiDeckAll: KanjiDeckRow[] = kanjiDeckRaw.map((r) => ({
  lesson: Number(r.lesson),
  orderInLesson: Number(r.order_in_lesson),
  kanji: r.kanji,
  unicodeHex: r.unicode_hex,
  isKanji: r.is_kanji === 'true',
  hanVietMain: r.han_viet_main.trim(),
  hanVietAccepted: splitPipe(r.han_viet_accepted),
  hanVietOther: splitPipe(r.han_viet_other),
  meaningEn: r.meaning_en,
  note: r.note,
  onyomi: splitPipe(r.onyomi),
  kunyomi: splitPipe(r.kunyomi),
  strokeCount: r.stroke_count ? Number(r.stroke_count) : null,
  needsReview: r.needs_review === 'true',
  reviewNote: r.review_note,
}));

// Lọc đợt 1: chỉ bài 1-12 (quyết định 2.1.2) — thực hiện ngay ở đây, không cần file CSV trung gian.
const kanjiDeckLessons1to12 = kanjiDeckAll.filter((r) => r.lesson <= LESSON_CUTOFF);

interface VnjpKanjiRow {
  lesson: number;
  orderInLessonVnjp: number;
  kanji: string;
  hanVietVnjp: string;
  meaningViVnjp: string;
}

const vnjpKanjiRaw = parseCsvObjects(readFileSync(join(dataDir, 'vnjp_kanji.csv'), 'utf8'));
const vnjpKanjiRows: VnjpKanjiRow[] = vnjpKanjiRaw.map((r) => ({
  lesson: Number(r.lesson),
  orderInLessonVnjp: Number(r.order_in_lesson_vnjp),
  kanji: r.kanji,
  hanVietVnjp: r.han_viet_vnjp.trim(),
  meaningViVnjp: r.meaning_vi_vnjp,
}));

interface VnjpExampleRow {
  lesson: number;
  kanjiParent: string;
  term: string;
  readingKana: string;
  meaningVi: string;
  needsReview: boolean;
  note: string;
}

const vnjpExamplesRaw = parseCsvObjects(readFileSync(join(dataDir, 'vnjp_examples.csv'), 'utf8'));
const vnjpExampleRows: VnjpExampleRow[] = vnjpExamplesRaw.map((r) => ({
  lesson: Number(r.lesson),
  kanjiParent: r.kanji_parent,
  term: r.term,
  readingKana: r.reading_kana,
  meaningVi: r.meaning_vi,
  needsReview: r.needs_review.trim() === 'true',
  note: r.note,
}));

// ============ 5. Gộp review_kanji: 192 dòng vnjp_kanji khớp theo ký tự kanji với kanji_512 (lesson<=12) ============
const kanjiDeckByChar = new Map(kanjiDeckLessons1to12.map((r) => [r.kanji, r]));

interface ReviewKanjiRow {
  unicodeHex: string;
  kanji: string;
  isKanji: boolean;
  deckLesson: number;
  deckOrder: number;
  vnjpLesson: number;
  vnjpOrder: number;
  hanVietMain: string | null;
  hanVietAccepted: string[];
  hanVietOther: string[];
  meaningEn: string | null;
  meaningVi: string | null;
  onyomi: string[];
  kunyomi: string[];
  strokeCount: number | null;
  note: string | null;
  svgPath: string;
  needsReview: boolean;
  reviewNote: string | null;
  strokePoints: StrokePoint[][] | null;
}

const hanVietMismatches: string[] = [];
const missingDeckMatch: string[] = [];
const svgMissing: string[] = [];

const reviewKanjiRows: ReviewKanjiRow[] = [];
for (const v of vnjpKanjiRows) {
  const deck = kanjiDeckByChar.get(v.kanji);
  if (!deck) {
    missingDeckMatch.push(v.kanji);
    continue;
  }

  // So lệch Hán Việt giữa 2 nguồn (deck gốc vs VNJP) — log, không âm thầm bỏ (plan §3.3).
  const accepted = [...deck.hanVietAccepted];
  if (v.hanVietVnjp && v.hanVietVnjp !== deck.hanVietMain && !accepted.includes(v.hanVietVnjp)) {
    accepted.push(v.hanVietVnjp);
    hanVietMismatches.push(`${v.kanji}: deck="${deck.hanVietMain}" vnjp="${v.hanVietVnjp}" (đã thêm vào han_viet_accepted)`);
  }

  let strokePoints: StrokePoint[][] | null = null;
  const svgFilePath = join(svgDir, `${deck.unicodeHex}.svg`);
  try {
    const svgText = readFileSync(svgFilePath, 'utf8');
    strokePoints = parseKanjiVgStrokePoints(svgText);
  } catch {
    svgMissing.push(deck.unicodeHex);
  }

  reviewKanjiRows.push({
    unicodeHex: deck.unicodeHex,
    kanji: deck.kanji,
    isKanji: deck.isKanji,
    deckLesson: deck.lesson,
    deckOrder: deck.orderInLesson,
    vnjpLesson: v.lesson,
    vnjpOrder: v.orderInLessonVnjp,
    hanVietMain: deck.hanVietMain || null,
    hanVietAccepted: accepted,
    hanVietOther: deck.hanVietOther,
    meaningEn: deck.meaningEn || null,
    meaningVi: v.meaningViVnjp || null,
    onyomi: deck.onyomi,
    kunyomi: deck.kunyomi,
    strokeCount: deck.strokeCount,
    note: deck.note || null,
    svgPath: `/kanjivg/${deck.unicodeHex}.svg`,
    needsReview: deck.needsReview,
    reviewNote: deck.reviewNote || null,
    strokePoints,
  });
}

// ============ 6. Gộp review_example: dedupe theo (term, reading_kana), giữ N-N với kanji cha ============
interface ReviewExampleRow {
  term: string;
  readingKana: string;
  meaningVi: string | null;
  needsReview: boolean;
  note: string | null;
  parents: { kanjiParent: string; lessonContext: number }[];
}

const exampleByKey = new Map<string, ReviewExampleRow>();
for (const row of vnjpExampleRows) {
  const key = `${row.term} ${row.readingKana}`;
  let existing = exampleByKey.get(key);
  if (!existing) {
    existing = {
      term: row.term,
      readingKana: row.readingKana,
      meaningVi: row.meaningVi || null,
      needsReview: row.needsReview,
      note: row.note || null,
      parents: [],
    };
    exampleByKey.set(key, existing);
  }
  // needs_review: nếu BẤT KỲ dòng CSV nào của cùng (term,reading_kana) bị gắn cờ, giữ true (khoan dung
  // ngược — ưu tiên an toàn, loại khỏi quiz nếu có bất kỳ nghi ngờ).
  if (row.needsReview) existing.needsReview = true;
  if (!existing.parents.some((p) => p.kanjiParent === row.kanjiParent && p.lessonContext === row.lesson)) {
    existing.parents.push({ kanjiParent: row.kanjiParent, lessonContext: row.lesson });
  }
}
const reviewExampleRows = Array.from(exampleByKey.values());

// ============ 7. Sinh SQL ============
const lines: string[] = [];
lines.push('-- Sinh tự động bởi scripts/seed-review.ts từ data/review/kanji-look-and-learn-512/.');
lines.push('-- Idempotent: chạy lại nhiều lần không tạo trùng (on conflict do update/do nothing).');
lines.push('-- Không sửa tay. Để nạp bài 13-32 sau: thêm dữ liệu VNJP tương ứng rồi chạy lại script này.');
lines.push('begin;');

lines.push('-- ===== review_kanji =====');
for (const k of reviewKanjiRows) {
  lines.push(
    `insert into review_kanji (unicode_hex, kanji, is_kanji, deck_lesson, deck_order, vnjp_lesson, vnjp_order, han_viet_main, han_viet_accepted, han_viet_other, meaning_en, meaning_vi, onyomi, kunyomi, stroke_count, note, svg_path, stroke_points, needs_review, review_note, confirmed_at) values (` +
      [
        sqlStr(k.unicodeHex),
        sqlStr(k.kanji),
        sqlBool(k.isKanji),
        sqlNum(k.deckLesson),
        sqlNum(k.deckOrder),
        sqlNum(k.vnjpLesson),
        sqlNum(k.vnjpOrder),
        sqlStr(k.hanVietMain),
        sqlTextArray(k.hanVietAccepted),
        sqlTextArray(k.hanVietOther),
        sqlStr(k.meaningEn),
        sqlStr(k.meaningVi),
        sqlTextArray(k.onyomi),
        sqlTextArray(k.kunyomi),
        sqlNum(k.strokeCount),
        sqlStr(k.note),
        sqlStr(k.svgPath),
        k.strokePoints ? sqlJsonb(k.strokePoints) : 'null',
        sqlBool(k.needsReview),
        sqlStr(k.reviewNote),
        // confirmed_at: needs_review=true -> chờ xác nhận (null); ngược lại coi như đã xác nhận ngay khi nạp.
        k.needsReview ? 'null' : 'now()',
      ].join(', ') +
      `)\n  on conflict (unicode_hex) do update set\n` +
      `    kanji = excluded.kanji, is_kanji = excluded.is_kanji, deck_lesson = excluded.deck_lesson,\n` +
      `    deck_order = excluded.deck_order, vnjp_lesson = excluded.vnjp_lesson, vnjp_order = excluded.vnjp_order,\n` +
      `    han_viet_main = excluded.han_viet_main, han_viet_accepted = excluded.han_viet_accepted,\n` +
      `    han_viet_other = excluded.han_viet_other, meaning_en = excluded.meaning_en, meaning_vi = excluded.meaning_vi,\n` +
      `    onyomi = excluded.onyomi, kunyomi = excluded.kunyomi, stroke_count = excluded.stroke_count,\n` +
      `    note = excluded.note, svg_path = excluded.svg_path, stroke_points = excluded.stroke_points,\n` +
      `    needs_review = excluded.needs_review, review_note = excluded.review_note;`
  );
}

lines.push('-- ===== review_example (dedupe theo term+reading_kana) =====');
for (const e of reviewExampleRows) {
  lines.push(
    `insert into review_example (term, reading_kana, meaning_vi, needs_review, note, confirmed_at) values (` +
      [
        sqlStr(e.term),
        sqlStr(e.readingKana),
        sqlStr(e.meaningVi),
        sqlBool(e.needsReview),
        sqlStr(e.note),
        e.needsReview ? 'null' : 'now()',
      ].join(', ') +
      `)\n  on conflict (term, reading_kana) do update set\n` +
      `    meaning_vi = excluded.meaning_vi, needs_review = excluded.needs_review, note = excluded.note;`
  );
}

lines.push('-- ===== review_example_kanji (N-N, 1 dòng mỗi (example, kanji_parent) xuất hiện trong CSV) =====');
for (const e of reviewExampleRows) {
  for (const p of e.parents) {
    lines.push(
      `insert into review_example_kanji (example_id, kanji_id, lesson_context)\n` +
        `  select e.id, k.id, ${sqlNum(p.lessonContext)} from review_example e, review_kanji k\n` +
        `  where e.term = ${sqlStr(e.term)} and e.reading_kana = ${sqlStr(e.readingKana)} and k.kanji = ${sqlStr(p.kanjiParent)}\n` +
        `  on conflict (example_id, kanji_id) do nothing;`
    );
  }
}

const needsReviewKanjiCount = reviewKanjiRows.filter((k) => k.needsReview).length;
const needsReviewExampleCount = reviewExampleRows.filter((e) => e.needsReview).length;

lines.push('-- ===== review_import_batch (nhật ký lần nạp này) =====');
lines.push(
  `insert into review_import_batch (source, kanji_count, example_count, needs_review_kanji_count, needs_review_example_count, notes) values (` +
    [
      sqlStr('kanji-look-and-learn-512-lesson1-12'),
      sqlNum(reviewKanjiRows.length),
      sqlNum(reviewExampleRows.length),
      sqlNum(needsReviewKanjiCount),
      sqlNum(needsReviewExampleCount),
      sqlStr(`Sinh bởi scripts/seed-review.ts lúc ${new Date().toISOString()}`),
    ].join(', ') +
    `);`
);

lines.push('commit;');

const outPath = join(root, 'supabase/seed_review.sql');
writeFileSync(outPath, lines.join('\n\n') + '\n');

// ============ 8. Log số liệu thật (không đoán trước) ============
console.log(`Đã sinh ${outPath}`);
console.log(`review_kanji: ${reviewKanjiRows.length} dòng (kỳ vọng 192)`);
console.log(`review_example: ${reviewExampleRows.length} dòng sau dedupe (từ ${vnjpExampleRows.length} dòng CSV gốc)`);
console.log(`needs_review ở review_kanji: ${needsReviewKanjiCount}`);
console.log(`needs_review ở review_example: ${needsReviewExampleCount}`);
console.log(`Lệch Hán Việt deck/VNJP phát hiện thêm (đã hợp nhất vào han_viet_accepted): ${hanVietMismatches.length}`);
hanVietMismatches.forEach((m) => console.log(`  - ${m}`));
if (missingDeckMatch.length > 0) {
  console.log(`CẢNH BÁO: ${missingDeckMatch.length} ký tự trong vnjp_kanji.csv không khớp được kanji_512.csv (lesson<=12): ${missingDeckMatch.join(', ')}`);
}
if (svgMissing.length > 0) {
  console.log(`CẢNH BÁO: không đọc được SVG cho ${svgMissing.length} mã hex (stroke_points=null): ${svgMissing.join(', ')}`);
}
if (reviewKanjiRows.length !== 192) {
  console.log(`CẢNH BÁO: số review_kanji (${reviewKanjiRows.length}) khác 192 như plan dự kiến — kiểm tra lại dữ liệu nguồn, không tự sửa số cho khớp.`);
}
