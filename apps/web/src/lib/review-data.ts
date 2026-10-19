import type { SupabaseClient } from '@supabase/supabase-js';
import { pickQuizCandidates, type ItemType, type MasteryLevel, type QuestionType, type QuizCandidate } from '@roadmap/core';
import { AppError } from './errors';
import { buildCandidates, restrictToTypes, type CardStateRow, type CatalogRow, type ReviewScope } from './review-scope';

/**
 * Đọc dữ liệu module Ôn luyện. Chỉ nhận SupabaseClient có sẵn (không import next/headers) để Server Component,
 * Server Action và script tích hợp gọi chung. RLS tự giới hạn dữ liệu cá nhân theo người đăng nhập.
 */

const PAGE = 1000; // Supabase giới hạn mặc định 1000 dòng/lần đọc
const IN_CHUNK = 150; // giữ URL của bộ lọc .in() đủ ngắn

/** Đọc hết các trang của một truy vấn (thứ tự ổn định do người gọi đặt .order()). */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new AppError(`Không đọc được dữ liệu ôn luyện: ${error.message}`, 'review_read_failed');
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

function chunks<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

// ---------- Home ----------
export interface LessonStat {
  lesson: number;
  total: number;
  mastered: number;
  seen: number;
}
export interface HomeStats {
  lessons: LessonStat[];
  overall: { total: number; mastered: number; seen: number; pending_kanji: number; pending_examples: number };
}

export async function loadHomeStats(supabase: SupabaseClient): Promise<HomeStats> {
  const { data, error } = await supabase.rpc('review_home_stats');
  if (error) throw new AppError(`Không đọc được thống kê ôn luyện: ${error.message}`, 'review_stats_failed');
  return data as HomeStats;
}

// ---------- Duyệt kanji ----------
export interface KanjiSummary {
  id: string;
  unicode_hex: string;
  kanji: string;
  han_viet_main: string | null;
  meaning_vi: string | null;
  vnjp_lesson: number | null;
  vnjp_order: number | null;
  confirmed_at: string | null;
}
const KANJI_SUMMARY_COLS = 'id, unicode_hex, kanji, han_viet_main, meaning_vi, vnjp_lesson, vnjp_order, confirmed_at';

export async function loadLessonKanji(supabase: SupabaseClient, lesson: number): Promise<KanjiSummary[]> {
  const { data, error } = await supabase.from('review_kanji').select(KANJI_SUMMARY_COLS).eq('vnjp_lesson', lesson).order('vnjp_order');
  if (error) throw new AppError(`Không đọc được kanji bài ${lesson}: ${error.message}`, 'review_read_failed');
  return (data ?? []) as KanjiSummary[];
}

/** Các bài đã nạp dữ liệu (theo vnjp_lesson), tăng dần. */
export async function loadLoadedLessons(supabase: SupabaseClient): Promise<number[]> {
  const stats = await loadHomeStats(supabase);
  return stats.lessons.map((l) => l.lesson);
}

export interface KanjiDetail extends KanjiSummary {
  is_kanji: boolean;
  han_viet_accepted: string[];
  meaning_en: string | null;
  onyomi: string[];
  kunyomi: string[];
  stroke_count: number | null;
  note: string | null;
  svg_path: string;
  needs_review: boolean;
  review_note: string | null;
  examples: ExampleSummary[];
  states: Partial<Record<QuestionType, { streak: number; correct_count: number; wrong_count: number; mastery_level: MasteryLevel }>>;
}
export interface ExampleSummary {
  id: string;
  term: string;
  reading_kana: string;
  meaning_vi: string | null;
  confirmed_at: string | null;
}

export async function loadKanjiDetail(supabase: SupabaseClient, hex: string): Promise<KanjiDetail | null> {
  const { data: k, error } = await supabase
    .from('review_kanji')
    .select(
      `${KANJI_SUMMARY_COLS}, is_kanji, han_viet_accepted, meaning_en, onyomi, kunyomi, stroke_count, note, svg_path, needs_review, review_note`
    )
    .eq('unicode_hex', hex)
    .maybeSingle();
  if (error) throw new AppError(`Không đọc được kanji: ${error.message}`, 'review_read_failed');
  if (!k) return null;

  const [{ data: links, error: linkErr }, { data: states, error: stateErr }] = await Promise.all([
    supabase
      .from('review_example_kanji')
      .select('review_example!inner(id, term, reading_kana, meaning_vi, confirmed_at)')
      .eq('kanji_id', k.id),
    supabase.from('review_card_state').select('question_type, streak, correct_count, wrong_count, mastery_level').eq('item_type', 'kanji').eq('item_id', k.id),
  ]);
  if (linkErr || stateErr) throw new AppError(`Không đọc được ví dụ/thống kê: ${(linkErr ?? stateErr)?.message}`, 'review_read_failed');

  const examples = (links ?? [])
    .map((l) => (l as unknown as { review_example: ExampleSummary }).review_example)
    .sort((a, b) => a.term.localeCompare(b.term, 'ja'));
  const stateMap: KanjiDetail['states'] = {};
  for (const s of states ?? []) stateMap[s.question_type as QuestionType] = s;
  return { ...(k as Omit<KanjiDetail, 'examples' | 'states'>), examples, states: stateMap };
}

// ---------- Danh sách ----------
export interface ReviewListSummary {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
}

export async function loadLists(supabase: SupabaseClient): Promise<ReviewListSummary[]> {
  const { data, error } = await supabase.from('review_list').select('id, name, created_at, review_list_item(count)').order('created_at');
  if (error) throw new AppError(`Không đọc được danh sách: ${error.message}`, 'review_read_failed');
  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    created_at: l.created_at,
    item_count: (l.review_list_item as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export interface ListItemView {
  item_type: ItemType;
  item_id: string;
  label: string; // kanji hoặc term
  sub: string; // Hán Việt hoặc cách đọc
  hex: string | null; // để link sang trang chi tiết kanji
}

export async function loadListDetail(
  supabase: SupabaseClient,
  listId: string
): Promise<{ id: string; name: string; items: ListItemView[] } | null> {
  const { data: list, error } = await supabase.from('review_list').select('id, name').eq('id', listId).maybeSingle();
  if (error) throw new AppError(`Không đọc được danh sách: ${error.message}`, 'review_read_failed');
  if (!list) return null;
  const items = await fetchAll<{ item_type: ItemType; item_id: string }>((from, to) =>
    supabase.from('review_list_item').select('item_type, item_id').eq('list_id', listId).order('added_at').range(from, to)
  );
  const kanjiIds = items.filter((i) => i.item_type === 'kanji').map((i) => i.item_id);
  const exampleIds = items.filter((i) => i.item_type === 'example').map((i) => i.item_id);
  const kanjiById = new Map<string, { kanji: string; han_viet_main: string | null; unicode_hex: string }>();
  const exampleById = new Map<string, { term: string; reading_kana: string }>();
  for (const ids of chunks(kanjiIds, IN_CHUNK)) {
    const { data } = await supabase.from('review_kanji').select('id, kanji, han_viet_main, unicode_hex').in('id', ids);
    for (const r of data ?? []) kanjiById.set(r.id, r);
  }
  for (const ids of chunks(exampleIds, IN_CHUNK)) {
    const { data } = await supabase.from('review_example').select('id, term, reading_kana').in('id', ids);
    for (const r of data ?? []) exampleById.set(r.id, r);
  }
  return {
    id: list.id,
    name: list.name,
    items: items.map((i) => {
      if (i.item_type === 'kanji') {
        const k = kanjiById.get(i.item_id);
        return { ...i, label: k?.kanji ?? '?', sub: k?.han_viet_main ?? '', hex: k?.unicode_hex ?? null };
      }
      const e = exampleById.get(i.item_id);
      return { ...i, label: e?.term ?? '?', sub: e?.reading_kana ?? '', hex: null };
    }),
  };
}

// ---------- Phạm vi luyện → candidates ----------
const CATALOG_COLS = 'item_type, item_id, question_type';
const STATE_COLS = 'item_type, item_id, question_type, correct_count, wrong_count, streak, mastery_level, last_reviewed_at';

async function catalogForItems(supabase: SupabaseClient, itemType: ItemType, ids: readonly string[]): Promise<CatalogRow[]> {
  const out: CatalogRow[] = [];
  for (const part of chunks(ids, IN_CHUNK)) {
    const { data, error } = await supabase.from('review_card_catalog').select(CATALOG_COLS).eq('item_type', itemType).in('item_id', part);
    if (error) throw new AppError(`Không đọc được danh mục thẻ: ${error.message}`, 'review_read_failed');
    out.push(...((data ?? []) as CatalogRow[]));
  }
  return out;
}

async function statesForItems(supabase: SupabaseClient, itemType: ItemType, ids: readonly string[]): Promise<CardStateRow[]> {
  const out: CardStateRow[] = [];
  for (const part of chunks(ids, IN_CHUNK)) {
    const { data, error } = await supabase.from('review_card_state').select(STATE_COLS).eq('item_type', itemType).in('item_id', part);
    if (error) throw new AppError(`Không đọc được tiến độ ôn: ${error.message}`, 'review_read_failed');
    out.push(...((data ?? []) as CardStateRow[]));
  }
  return out;
}

async function candidatesForRefs(supabase: SupabaseClient, refs: { item_type: ItemType; item_id: string }[]): Promise<QuizCandidate[]> {
  const kanjiIds = refs.filter((r) => r.item_type === 'kanji').map((r) => r.item_id);
  const exampleIds = refs.filter((r) => r.item_type === 'example').map((r) => r.item_id);
  const [kc, ec, ks, es] = await Promise.all([
    catalogForItems(supabase, 'kanji', kanjiIds),
    catalogForItems(supabase, 'example', exampleIds),
    statesForItems(supabase, 'kanji', kanjiIds),
    statesForItems(supabase, 'example', exampleIds),
  ]);
  // Giữ thứ tự của refs (thứ tự bài/danh sách)
  const order = new Map(refs.map((r, i) => [`${r.item_type}:${r.item_id}`, i]));
  const catalog = [...kc, ...ec].sort(
    (a, b) => (order.get(`${a.item_type}:${a.item_id}`) ?? 0) - (order.get(`${b.item_type}:${b.item_id}`) ?? 0)
  );
  return buildCandidates(catalog, [...ks, ...es]);
}

/** Tất cả mục của một phạm vi kèm loại câu áp dụng + trạng thái (chưa lọc theo loại câu). */
export async function loadScopeCandidates(supabase: SupabaseClient, scope: ReviewScope): Promise<QuizCandidate[]> {
  switch (scope.kind) {
    case 'lesson': {
      const catalog = await fetchAll<CatalogRow>((from, to) =>
        supabase.from('review_card_catalog').select(CATALOG_COLS).eq('lesson', scope.lesson).order('item_type').order('item_id').range(from, to)
      );
      const kanji = await loadLessonKanji(supabase, scope.lesson);
      // kanji theo thứ tự trong bài trước, rồi tới ví dụ
      const kanjiOrder = new Map(kanji.map((k, i) => [k.id, i]));
      catalog.sort(
        (a, b) =>
          (a.item_type === 'kanji' ? (kanjiOrder.get(a.item_id) ?? 0) : 1000) - (b.item_type === 'kanji' ? (kanjiOrder.get(b.item_id) ?? 0) : 1000)
      );
      const ids = (t: ItemType) => [...new Set(catalog.filter((c) => c.item_type === t).map((c) => c.item_id))];
      const [ks, es] = await Promise.all([statesForItems(supabase, 'kanji', ids('kanji')), statesForItems(supabase, 'example', ids('example'))]);
      return buildCandidates(catalog, [...ks, ...es]);
    }
    case 'list': {
      const items = await fetchAll<{ item_type: ItemType; item_id: string }>((from, to) =>
        supabase.from('review_list_item').select('item_type, item_id').in('list_id', scope.listIds).order('added_at').range(from, to)
      );
      return candidatesForRefs(supabase, items);
    }
    case 'kanji': {
      const { data, error } = await supabase.from('review_kanji').select('id, unicode_hex').in('unicode_hex', scope.hexes);
      if (error) throw new AppError(`Không đọc được kanji đã chọn: ${error.message}`, 'review_read_failed');
      const idByHex = new Map((data ?? []).map((r) => [r.unicode_hex, r.id]));
      const refs = scope.hexes.flatMap((h) => (idByHex.has(h) ? [{ item_type: 'kanji' as const, item_id: idByHex.get(h)! }] : []));
      return candidatesForRefs(supabase, refs);
    }
    case 'smart': {
      const [catalog, states] = await Promise.all([
        fetchAll<CatalogRow>((from, to) =>
          supabase.from('review_card_catalog').select(CATALOG_COLS).order('item_type').order('item_id').order('question_type').range(from, to)
        ),
        fetchAll<CardStateRow>((from, to) =>
          supabase.from('review_card_state').select(STATE_COLS).order('item_type').order('item_id').order('question_type').range(from, to)
        ),
      ]);
      return buildCandidates(catalog, states);
    }
  }
}

export interface QuizQuestion {
  item_type: ItemType;
  item_id: string;
  question_type: QuestionType;
  prompt: {
    kanji?: string;
    term?: string;
    han_viet_main?: string;
    meaning_en?: string | null;
    meaning_vi?: string | null;
    stroke_count?: number | null;
    /** E1 cho item_type='example': trắc nghiệm — term đúng + tối đa 3 nhiễu, đã trộn. Không đánh dấu đáp án
     * đúng; có thể NGẮN HƠN 4 phần tử khi phạm vi luyện không đủ ví dụ khác (tối thiểu 1 = đáp án đúng). */
    choices?: string[];
  };
}

/**
 * Dựng đề cho một phiên: lọc theo loại câu, LUÔN ưu tiên mục có tỉ lệ đúng thấp/ít luyện (không còn chỉ áp
 * dụng cho scope 'smart' — mọi phạm vi lesson/list/kanji đều được ưu tiên ngầm, không có UI chọn chiến lược
 * riêng), rồi RPC trộn + cắt theo số câu người dùng chọn.
 */
export async function loadQuizBatch(
  supabase: SupabaseClient,
  scope: ReviewScope,
  types: QuestionType[],
  n: number
): Promise<QuizQuestion[]> {
  const restricted = restrictToTypes(await loadScopeCandidates(supabase, scope), types);
  // Sắp lại toàn bộ theo độ ưu tiên "hay sai nhất" (limit = độ dài mảng → chỉ đổi thứ tự, không cắt bớt).
  const candidates = pickQuizCandidates(restricted, 'least_accuracy', restricted.length);
  if (candidates.length === 0) return [];
  // RPC tự "order by random() limit p_limit" trên các refs được gửi — nếu gửi nguyên candidates đã sắp (có
  // thể rất dài) thì bước random sẽ xoá sạch ưu tiên vừa sắp. Thu hẹp về một pool nhỏ hơn LẤY TỪ ĐẦU mảng đã
  // sắp (nghiêng hẳn về mục yếu) rồi mới để RPC random trong pool đó, vừa giữ ưu tiên vừa có đa dạng mỗi lần.
  const poolSize = Math.min(candidates.length, Math.max(n * 3, 40));
  const refs = candidates.slice(0, poolSize).map((c) => ({ item_type: c.itemType, item_id: c.itemId }));
  const { data, error } = await supabase.rpc('review_get_quiz_batch', { p_item_refs: refs, p_question_types: types, p_limit: n });
  if (error) throw new AppError(`Không tạo được đề: ${error.message}`, 'review_quiz_failed');
  return (data ?? []) as QuizQuestion[];
}

// ---------- Nét chuẩn cho tự chấm K2 (CLAUDE.md #4c: heuristic client-side, không OCR/ML) ----------
/** Toạ độ nét chuẩn KanjiVG của một kanji, dùng để scoreHandwriting ở client. null = chưa seed (script M-sau). */
export async function loadKanjiStrokeReference(supabase: SupabaseClient, itemId: string): Promise<unknown[] | null> {
  const { data, error } = await supabase.from('review_kanji').select('stroke_points').eq('id', itemId).maybeSingle();
  if (error) throw new AppError(`Không đọc được toạ độ nét chuẩn: ${error.message}`, 'review_read_failed');
  return (data?.stroke_points as unknown[] | null) ?? null;
}

// ---------- Thống kê (trang /review/stats) ----------
export interface AttemptRow {
  question_type: QuestionType;
  is_correct: boolean;
  answered_at: string;
}

/** Toàn bộ lịch sử trả lời của người dùng (RLS tự giới hạn theo user_id) — dùng cho trang thống kê. */
export async function loadReviewAttempts(supabase: SupabaseClient): Promise<AttemptRow[]> {
  return fetchAll<AttemptRow>((from, to) =>
    supabase.from('review_attempt_log').select('question_type, is_correct, answered_at').order('answered_at').range(from, to)
  );
}
