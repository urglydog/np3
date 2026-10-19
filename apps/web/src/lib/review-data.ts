/**
 * Module "Ôn luyện" — đọc dữ liệu qua Supabase server client. Theo mẫu apps/web/src/lib/task-detail.ts:
 * chỉ query + map snake_case→camelCase ở đây, mọi tính toán (mastery, nhóm theo ngày...) nằm ở
 * packages/core/src/review.ts hoặc apps/web/src/lib/review-stats.ts (hàm thuần).
 * Không có FK thật giữa review_card_state/review_attempt_log và review_kanji/review_example
 * (item_id là polymorphic) nên PHẢI query riêng từng bảng rồi map ở TS — không viết SQL join ảo.
 */
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { CardState, MasteryLevel } from '@roadmap/core';
import type { AttemptRaw, ReviewQuestionType } from '@/lib/review-stats';

export type ReviewItemType = 'kanji' | 'example';

export interface ReviewCardStateRow {
  itemType: ReviewItemType;
  itemId: string;
  questionType: ReviewQuestionType;
  state: CardState;
}

function toCardState(row: {
  correct_count: number;
  wrong_count: number;
  streak: number;
  mastery_level: string;
  last_reviewed_at: string | null;
}): CardState {
  return {
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    streak: row.streak,
    masteryLevel: row.mastery_level as MasteryLevel,
    lastReviewedAt: row.last_reviewed_at,
  };
}

export interface ReviewHomeData {
  cardStates: ReviewCardStateRow[];
  kanjiLessonById: Map<string, number>;
}

/** Dữ liệu cho Home (`review/page.tsx`): toàn bộ review_card_state của user + bài (deck_lesson) của mỗi kanji. */
export async function loadReviewHomeData(): Promise<ReviewHomeData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: states }, { data: kanjiRows }] = await Promise.all([
    supabase
      .from('review_card_state')
      .select('item_type, item_id, question_type, correct_count, wrong_count, streak, mastery_level, last_reviewed_at'),
    supabase.from('review_kanji').select('id, deck_lesson'),
  ]);

  const kanjiLessonById = new Map<string, number>();
  for (const k of kanjiRows ?? []) kanjiLessonById.set(k.id as string, k.deck_lesson as number);

  const cardStates: ReviewCardStateRow[] = (states ?? []).map((s) => ({
    itemType: s.item_type as ReviewItemType,
    itemId: s.item_id as string,
    questionType: s.question_type as ReviewQuestionType,
    state: toCardState(s),
  }));

  return { cardStates, kanjiLessonById };
}

export interface ReviewStatsData {
  cardStates: ReviewCardStateRow[];
  attempts: AttemptRaw[];
}

/** Dữ liệu cho `review/stats/page.tsx`: review_card_state (tổng %) + toàn bộ review_attempt_log của user. */
export async function loadReviewStatsData(): Promise<ReviewStatsData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: states }, { data: logs }] = await Promise.all([
    supabase
      .from('review_card_state')
      .select('item_type, item_id, question_type, correct_count, wrong_count, streak, mastery_level, last_reviewed_at'),
    supabase.from('review_attempt_log').select('question_type, is_correct, answered_at').order('answered_at', { ascending: true }),
  ]);

  const cardStates: ReviewCardStateRow[] = (states ?? []).map((s) => ({
    itemType: s.item_type as ReviewItemType,
    itemId: s.item_id as string,
    questionType: s.question_type as ReviewQuestionType,
    state: toCardState(s),
  }));

  const attempts: AttemptRaw[] = (logs ?? []).map((l) => ({
    answeredAtIso: l.answered_at as string,
    questionType: l.question_type as ReviewQuestionType,
    isCorrect: l.is_correct as boolean,
  }));

  return { cardStates, attempts };
}

export interface BrowseKanjiRow {
  id: string;
  unicodeHex: string;
  kanji: string;
  hanVietMain: string | null;
  deckOrder: number;
}

/** Danh sách kanji của 1 bài (deck_lesson), sắp theo deck_order — dùng cho `review/browse`. */
export async function loadKanjiByLesson(lesson: number): Promise<BrowseKanjiRow[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('review_kanji')
    .select('id, unicode_hex, kanji, han_viet_main, deck_order')
    .eq('deck_lesson', lesson)
    .order('deck_order', { ascending: true });

  return (data ?? []).map((k) => ({
    id: k.id as string,
    unicodeHex: k.unicode_hex as string,
    kanji: k.kanji as string,
    hanVietMain: k.han_viet_main as string | null,
    deckOrder: k.deck_order as number,
  }));
}

export interface ReviewListSummary {
  id: string;
  name: string;
  itemCount: number;
}

/** Danh sách list cá nhân + số lượng item mỗi list — dùng cho `review/lists` và bottom sheet "Thêm vào danh sách". */
export async function loadReviewLists(): Promise<ReviewListSummary[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: lists } = await supabase.from('review_list').select('id, name').order('created_at', { ascending: true });
  if (!lists || lists.length === 0) return [];

  const { data: items } = await supabase
    .from('review_list_item')
    .select('list_id')
    .in('list_id', lists.map((l) => l.id as string));

  const countByList = new Map<string, number>();
  for (const it of items ?? []) {
    const id = it.list_id as string;
    countByList.set(id, (countByList.get(id) ?? 0) + 1);
  }

  return lists.map((l) => ({ id: l.id as string, name: l.name as string, itemCount: countByList.get(l.id as string) ?? 0 }));
}

export interface ReviewListDetail extends ReviewListSummary {
  items: Array<{ itemType: ReviewItemType; itemId: string; label: string }>;
}

/** Chi tiết toàn bộ list (dùng cho màn `review/lists`: tên item hiển thị để xoá từng mục). */
export async function loadReviewListsWithItems(): Promise<ReviewListDetail[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: lists } = await supabase.from('review_list').select('id, name').order('created_at', { ascending: true });
  if (!lists || lists.length === 0) return [];

  const { data: items } = await supabase
    .from('review_list_item')
    .select('list_id, item_type, item_id')
    .in('list_id', lists.map((l) => l.id as string));

  const kanjiIds = (items ?? []).filter((i) => i.item_type === 'kanji').map((i) => i.item_id as string);
  const exampleIds = (items ?? []).filter((i) => i.item_type === 'example').map((i) => i.item_id as string);

  const [{ data: kanjiRows }, { data: exampleRows }] = await Promise.all([
    kanjiIds.length > 0
      ? supabase.from('review_kanji').select('id, kanji').in('id', kanjiIds)
      : Promise.resolve({ data: [] as { id: string; kanji: string }[] }),
    exampleIds.length > 0
      ? supabase.from('review_example').select('id, term').in('id', exampleIds)
      : Promise.resolve({ data: [] as { id: string; term: string }[] }),
  ]);

  const kanjiLabelById = new Map<string, string>();
  for (const k of kanjiRows ?? []) kanjiLabelById.set(k.id as string, k.kanji as string);
  const exampleLabelById = new Map<string, string>();
  for (const e of exampleRows ?? []) exampleLabelById.set(e.id as string, e.term as string);

  return lists.map((l) => {
    const listItems = (items ?? [])
      .filter((i) => i.list_id === l.id)
      .map((i) => ({
        itemType: i.item_type as ReviewItemType,
        itemId: i.item_id as string,
        label:
          i.item_type === 'kanji'
            ? kanjiLabelById.get(i.item_id as string) ?? '?'
            : exampleLabelById.get(i.item_id as string) ?? '?',
      }));
    return { id: l.id as string, name: l.name as string, itemCount: listItems.length, items: listItems };
  });
}

export interface QuizBuilderKanjiRow {
  id: string;
  deckLesson: number;
  isKanji: boolean;
  hanVietMain: string | null;
  confirmedAt: string | null;
  k1State: CardState | null;
  k2State: CardState | null;
}

export interface QuizBuilderExampleRow {
  id: string;
  meaningVi: string | null;
  confirmedAt: string | null;
  lessons: number[];
  e1State: CardState | null;
  e2State: CardState | null;
}

export interface QuizBuilderData {
  kanji: QuizBuilderKanjiRow[];
  examples: QuizBuilderExampleRow[];
}

/**
 * Toàn bộ kanji/ví dụ (đã seed) + review_card_state của user hiện tại — dùng để dựng QuizCandidate[]
 * (packages/core) ở màn `review/quiz/new`. KHÔNG tính toán gì ở đây (xem lib/review-quiz-candidates.ts).
 */
export async function loadQuizBuilderData(): Promise<QuizBuilderData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: kanjiRows }, { data: exampleRows }, { data: exLinks }, { data: cardStates }] = await Promise.all([
    supabase.from('review_kanji').select('id, deck_lesson, is_kanji, han_viet_main, confirmed_at'),
    supabase.from('review_example').select('id, meaning_vi, confirmed_at'),
    supabase.from('review_example_kanji').select('example_id, lesson_context'),
    supabase
      .from('review_card_state')
      .select('item_type, item_id, question_type, correct_count, wrong_count, streak, mastery_level, last_reviewed_at'),
  ]);

  const lessonsByExample = new Map<string, Set<number>>();
  for (const l of exLinks ?? []) {
    const id = l.example_id as string;
    const set = lessonsByExample.get(id) ?? new Set<number>();
    set.add(l.lesson_context as number);
    lessonsByExample.set(id, set);
  }

  // key = `${itemType}:${itemId}:${questionType}`
  const stateMap = new Map<string, CardState>();
  for (const s of cardStates ?? []) {
    stateMap.set(`${s.item_type}:${s.item_id}:${s.question_type}`, toCardState(s));
  }

  const kanji: QuizBuilderKanjiRow[] = (kanjiRows ?? []).map((k) => ({
    id: k.id as string,
    deckLesson: k.deck_lesson as number,
    isKanji: k.is_kanji as boolean,
    hanVietMain: k.han_viet_main as string | null,
    confirmedAt: k.confirmed_at as string | null,
    k1State: stateMap.get(`kanji:${k.id}:K1`) ?? null,
    k2State: stateMap.get(`kanji:${k.id}:K2`) ?? null,
  }));

  const examples: QuizBuilderExampleRow[] = (exampleRows ?? []).map((e) => ({
    id: e.id as string,
    meaningVi: e.meaning_vi as string | null,
    confirmedAt: e.confirmed_at as string | null,
    lessons: Array.from(lessonsByExample.get(e.id as string) ?? []),
    e1State: stateMap.get(`example:${e.id}:E1`) ?? null,
    e2State: stateMap.get(`example:${e.id}:E2`) ?? null,
  }));

  return { kanji, examples };
}

export interface KanjiDetail {
  id: string;
  unicodeHex: string;
  kanji: string;
  hanVietMain: string | null;
  meaningEn: string | null;
  meaningVi: string | null;
  onyomi: string[];
  kunyomi: string[];
  strokeCount: number | null;
  note: string | null;
  svgPath: string;
  strokePoints: unknown | null;
  needsReview: boolean;
  confirmedAt: string | null;
}

export interface ExampleRow {
  id: string;
  term: string;
  readingKana: string;
  meaningVi: string | null;
}

export interface KanjiDetailData {
  kanji: KanjiDetail;
  examples: ExampleRow[];
  k1State: CardState | null;
  k2State: CardState | null;
}

/** Chi tiết 1 kanji theo unicode_hex — dùng cho `review/browse/[hex]`. Trả null nếu không tồn tại. */
export async function loadKanjiDetail(hex: string): Promise<KanjiDetailData | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: kanjiRow } = await supabase
    .from('review_kanji')
    .select(
      'id, unicode_hex, kanji, han_viet_main, meaning_en, meaning_vi, onyomi, kunyomi, stroke_count, note, svg_path, stroke_points, needs_review, confirmed_at',
    )
    .eq('unicode_hex', hex)
    .maybeSingle();
  if (!kanjiRow) return null;

  const [{ data: exampleLinks }, { data: cardStates }] = await Promise.all([
    supabase.from('review_example_kanji').select('example_id').eq('kanji_id', kanjiRow.id),
    supabase
      .from('review_card_state')
      .select('question_type, correct_count, wrong_count, streak, mastery_level, last_reviewed_at')
      .eq('item_type', 'kanji')
      .eq('item_id', kanjiRow.id)
      .in('question_type', ['K1', 'K2']),
  ]);

  const exampleIds = (exampleLinks ?? []).map((e) => e.example_id as string);
  const { data: exampleRows } =
    exampleIds.length > 0
      ? await supabase.from('review_example').select('id, term, reading_kana, meaning_vi').in('id', exampleIds)
      : { data: [] as { id: string; term: string; reading_kana: string; meaning_vi: string | null }[] };

  const examples: ExampleRow[] = (exampleRows ?? []).map((e) => ({
    id: e.id as string,
    term: e.term as string,
    readingKana: e.reading_kana as string,
    meaningVi: e.meaning_vi as string | null,
  }));

  const k1Row = (cardStates ?? []).find((s) => s.question_type === 'K1');
  const k2Row = (cardStates ?? []).find((s) => s.question_type === 'K2');

  return {
    kanji: {
      id: kanjiRow.id as string,
      unicodeHex: kanjiRow.unicode_hex as string,
      kanji: kanjiRow.kanji as string,
      hanVietMain: kanjiRow.han_viet_main as string | null,
      meaningEn: kanjiRow.meaning_en as string | null,
      meaningVi: kanjiRow.meaning_vi as string | null,
      onyomi: (kanjiRow.onyomi as string[]) ?? [],
      kunyomi: (kanjiRow.kunyomi as string[]) ?? [],
      strokeCount: kanjiRow.stroke_count as number | null,
      note: kanjiRow.note as string | null,
      svgPath: kanjiRow.svg_path as string,
      strokePoints: kanjiRow.stroke_points,
      needsReview: kanjiRow.needs_review as boolean,
      confirmedAt: kanjiRow.confirmed_at as string | null,
    },
    examples,
    k1State: k1Row ? toCardState(k1Row) : null,
    k2State: k2Row ? toCardState(k2Row) : null,
  };
}
