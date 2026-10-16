// Sinh supabase/seed-review.sql từ data/review/kanji-look-and-learn-512/*.csv (module Ôn luyện, M1b).
// Chạy: npm run db:seed:review:gen
// File SQL sinh ra IDEMPOTENT (upsert theo khoá tự nhiên: unicode_hex, (term, reading_kana)) — chạy lại nhiều lần
// cho cùng kết quả, không đụng dữ liệu cá nhân (review_list, review_card_state...), giữ confirmed_at đã xác nhận.
// Dùng được cả cho local (db reset tự nạp) lẫn dán vào SQL Editor của Supabase cloud.
// Phạm vi đợt 1: CHỈ kanji bài 1–12 (MAX_LESSON). kanji_512.csv đầy đủ chỉ dùng để tra âm Hán Việt cho đáp án E1.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hanVietPartsForTerm } from '@roadmap/core';

const MAX_LESSON = 12;
const SOURCE = 'kanji-look-and-learn-512';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'data/review', SOURCE);

/** Parser CSV RFC 4180 tối giản: ngoặc kép, "" thoát, dấu phẩy/xuống dòng trong ô; bỏ BOM đầu file. */
function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => !(r.length === 1 && r[0] === ''));
  return body.map((r) => {
    if (r.length !== header.length) throw new Error(`Dòng CSV lệch số cột (${r.length}/${header.length}): ${r.join(',')}`);
    return Object.fromEntries(header.map((h, i) => [h, r[i]]));
  });
}

const read = (name: string) => parseCsv(readFileSync(join(dataDir, name), 'utf8'));
const deck = read('kanji_512.csv');
const vnjpKanji = read('vnjp_kanji.csv');
const vnjpExamples = read('vnjp_examples.csv');

const splitPipe = (s: string): string[] => s.split('|').map((x) => x.trim()).filter(Boolean);
const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)];
const sqlStr = (v: string | null | undefined): string => (v == null || v === '' ? 'null' : `'${v.replace(/'/g, "''")}'`);
const sqlArr = (xs: string[]): string => (xs.length ? `array[${xs.map(sqlStr).join(',')}]::text[]` : `'{}'::text[]`);
const sqlInt = (v: string): string => (v.trim() === '' ? 'null' : String(Number.parseInt(v, 10)));

// ---------- Kanji ----------
const deckByKanji = new Map(deck.map((r) => [r.kanji, r]));
const vnjpByKanji = new Map(vnjpKanji.map((r) => [r.kanji, r]));
const warnings: string[] = [];

/** Các cách viết Hán Việt chấp nhận khi chấm: main + accepted + bản VNJP nếu lệch. KHÔNG dùng han_viet_other. */
function acceptedForms(kanji: string): string[] {
  const d = deckByKanji.get(kanji);
  if (!d || !d.han_viet_main) return [];
  const v = vnjpByKanji.get(kanji);
  return uniq([d.han_viet_main, ...splitPipe(d.han_viet_accepted), ...(v?.han_viet_vnjp ? [v.han_viet_vnjp.trim()] : [])]);
}

interface KanjiRow {
  deck: Record<string, string>;
  vnjp: Record<string, string>;
}
const kanjiRows: KanjiRow[] = vnjpKanji.map((v) => {
  const d = deckByKanji.get(v.kanji);
  if (!d) throw new Error(`Kanji ${v.kanji} có trong vnjp_kanji.csv nhưng không có trong kanji_512.csv`);
  if (Number(d.lesson) > MAX_LESSON) throw new Error(`Kanji ${v.kanji} thuộc bài ${d.lesson} > ${MAX_LESSON}: ngoài phạm vi đợt 1`);
  if (d.lesson !== v.lesson) warnings.push(`Bài lệch: ${v.kanji} deck bài ${d.lesson}, VNJP bài ${v.lesson}`);
  if (v.han_viet_vnjp && v.han_viet_vnjp.trim() !== d.han_viet_main)
    warnings.push(`Hán Việt lệch: ${v.kanji} deck "${d.han_viet_main}" / VNJP "${v.han_viet_vnjp}" → chấp nhận cả hai`);
  return { deck: d, vnjp: v };
});

// ---------- Ví dụ: gộp theo (term, reading_kana) ----------
interface ExampleAgg {
  term: string;
  reading: string;
  meanings: string[];
  notes: string[];
  needsReview: boolean;
  links: Map<string, number>; // kanji cha → bài VNJP (giữ lần xuất hiện đầu)
}
const examples = new Map<string, ExampleAgg>();
for (const r of vnjpExamples) {
  if (Number(r.lesson) > MAX_LESSON) throw new Error(`Ví dụ "${r.term}" thuộc bài ${r.lesson} > ${MAX_LESSON}`);
  if (!vnjpByKanji.has(r.kanji_parent)) throw new Error(`Ví dụ "${r.term}" có kanji cha ${r.kanji_parent} chưa nạp`);
  const key = `${r.term}\t${r.reading_kana}`;
  const agg = examples.get(key) ?? { term: r.term, reading: r.reading_kana, meanings: [], notes: [], needsReview: false, links: new Map() };
  if (r.meaning_vi.trim()) agg.meanings.push(r.meaning_vi.trim());
  if (r.note.trim()) agg.notes.push(r.note.trim());
  agg.needsReview ||= r.needs_review.trim() === '1' || r.needs_review.trim().toLowerCase() === 'true';
  if (!agg.links.has(r.kanji_parent)) agg.links.set(r.kanji_parent, Number(r.lesson));
  examples.set(key, agg);
}

const lookup = (k: string) => {
  const forms = acceptedForms(k);
  return forms.length ? forms : undefined;
};

// ---------- Sinh SQL ----------
const out: string[] = [];
out.push('-- Sinh tự động bởi scripts/gen-review-seed.ts từ data/review/kanji-look-and-learn-512. Không sửa tay.');
out.push('-- Idempotent: chạy lại nhiều lần cho cùng kết quả, không đụng dữ liệu cá nhân, giữ confirmed_at đã có.');
out.push('begin;');
out.push('');
out.push(
  'insert into review_kanji (unicode_hex, kanji, is_kanji, deck_lesson, deck_order, vnjp_lesson, vnjp_order, han_viet_main, han_viet_accepted, han_viet_other, meaning_en, meaning_vi, onyomi, kunyomi, stroke_count, note, svg_path, needs_review, review_note, confirmed_at) values'
);
out.push(
  kanjiRows
    .map(({ deck: d, vnjp: v }) => {
      const needsReview = d.needs_review.trim().toLowerCase() === 'true';
      const accepted = acceptedForms(d.kanji).filter((f) => f !== d.han_viet_main);
      return `  (${sqlStr(d.unicode_hex)}, ${sqlStr(d.kanji)}, ${d.is_kanji === 'false' ? 'false' : 'true'}, ${sqlInt(d.lesson)}, ${sqlInt(
        d.order_in_lesson
      )}, ${sqlInt(v.lesson)}, ${sqlInt(v.order_in_lesson_vnjp)}, ${sqlStr(d.han_viet_main)}, ${sqlArr(accepted)}, ${sqlArr(
        splitPipe(d.han_viet_other)
      )}, ${sqlStr(d.meaning_en)}, ${sqlStr(v.meaning_vi_vnjp)}, ${sqlArr(splitPipe(d.onyomi))}, ${sqlArr(splitPipe(d.kunyomi))}, ${sqlInt(
        d.stroke_count
      )}, ${sqlStr(d.note)}, ${sqlStr(`/kanjivg/${d.unicode_hex}.svg`)}, ${needsReview}, ${sqlStr(d.review_note)}, ${
        needsReview ? 'null' : 'now()'
      })`;
    })
    .join(',\n')
);
out.push('on conflict (unicode_hex) do update set');
out.push(
  '  kanji = excluded.kanji, is_kanji = excluded.is_kanji, deck_lesson = excluded.deck_lesson, deck_order = excluded.deck_order, vnjp_lesson = excluded.vnjp_lesson, vnjp_order = excluded.vnjp_order, han_viet_main = excluded.han_viet_main, han_viet_accepted = excluded.han_viet_accepted, han_viet_other = excluded.han_viet_other, meaning_en = excluded.meaning_en, meaning_vi = excluded.meaning_vi, onyomi = excluded.onyomi, kunyomi = excluded.kunyomi, stroke_count = excluded.stroke_count, note = excluded.note, svg_path = excluded.svg_path, needs_review = excluded.needs_review, review_note = excluded.review_note,'
);
out.push('  confirmed_at = coalesce(review_kanji.confirmed_at, excluded.confirmed_at);');
out.push('');

const exampleList = [...examples.values()];
let e1Count = 0;
out.push('insert into review_example (term, reading_kana, meaning_vi, needs_review, note, han_viet_parts, confirmed_at) values');
out.push(
  exampleList
    .map((e) => {
      const parts = hanVietPartsForTerm(e.term, lookup);
      if (parts) e1Count++;
      const meaning = uniq(e.meanings).join('; ');
      return `  (${sqlStr(e.term)}, ${sqlStr(e.reading)}, ${sqlStr(meaning)}, ${e.needsReview}, ${sqlStr(uniq(e.notes).join('; '))}, ${
        parts ? `${sqlStr(JSON.stringify(parts))}::jsonb` : 'null'
      }, ${e.needsReview ? 'null' : 'now()'})`;
    })
    .join(',\n')
);
out.push('on conflict (term, reading_kana) do update set');
out.push(
  '  meaning_vi = excluded.meaning_vi, needs_review = excluded.needs_review, note = excluded.note, han_viet_parts = excluded.han_viet_parts,'
);
out.push('  confirmed_at = coalesce(review_example.confirmed_at, excluded.confirmed_at);');
out.push('');

const links = exampleList.flatMap((e) => [...e.links.entries()].map(([kanji, lesson]) => ({ e, kanji, lesson })));
out.push('insert into review_example_kanji (example_id, kanji_id, lesson_context)');
out.push('select e.id, k.id, v.lesson from (values');
out.push(links.map((l) => `  (${sqlStr(l.e.term)}, ${sqlStr(l.e.reading)}, ${sqlStr(l.kanji)}, ${l.lesson})`).join(',\n'));
out.push(') as v(term, reading_kana, kanji, lesson)');
out.push('join review_example e on e.term = v.term and e.reading_kana = v.reading_kana');
out.push('join review_kanji k on k.kanji = v.kanji');
out.push('on conflict (example_id, kanji_id) do update set lesson_context = excluded.lesson_context;');
out.push('');

const nrKanji = kanjiRows.filter((r) => r.deck.needs_review.trim().toLowerCase() === 'true');
const nrExamples = exampleList.filter((e) => e.needsReview);
out.push(
  `insert into review_import_batch (source, kanji_count, example_count, needs_review_kanji_count, needs_review_example_count, notes) values (${sqlStr(
    SOURCE
  )}, ${kanjiRows.length}, ${exampleList.length}, ${nrKanji.length}, ${nrExamples.length}, ${sqlStr(
    `Bài 1–${MAX_LESSON}; ${vnjpExamples.length} dòng ví dụ CSV gộp thành ${exampleList.length}; ${links.length} liên kết; ${e1Count} ví dụ có đáp án E1`
  )});`
);
out.push('');
out.push('commit;');

writeFileSync(join(root, 'supabase/seed-review.sql'), out.join('\n') + '\n');

// ---------- Log kiểm đếm (không suy đoán: đếm bằng parser CSV đúng) ----------
console.log(`Kanji: ${kanjiRows.length} (bài 1–${MAX_LESSON}), chờ xác nhận: ${nrKanji.length} → ${nrKanji.map((r) => r.deck.kanji).join(' ')}`);
console.log(`Ví dụ: ${vnjpExamples.length} dòng CSV → ${exampleList.length} ví dụ duy nhất, ${links.length} liên kết kanji`);
console.log(`Ví dụ chờ xác nhận: ${nrExamples.length} → ${nrExamples.map((e) => e.term).join(' ')}`);
console.log(`Ví dụ có đáp án E1 (đủ âm Hán Việt): ${e1Count}/${exampleList.length}`);
const meaningMerged = exampleList.filter((e) => uniq(e.meanings).length > 1).length;
console.log(`Ví dụ gộp nhiều nghĩa (xuất hiện ở nhiều kanji cha với nghĩa khác nhau): ${meaningMerged}`);
for (const w of warnings) console.log(`Cảnh báo: ${w}`);
console.log('Đã ghi supabase/seed-review.sql');
