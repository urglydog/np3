/**
 * Module "Ôn luyện" (Kanji 512): logic thuần cho chấm điểm, mức thuộc bài (mastery) và chọn câu hỏi.
 * Nguyên tắc: hàm thuần, không đọc đồng hồ (nhận nowIso), không import Supabase/DOM.
 * Phần chấm điểm có bản mirror SQL trong supabase/migrations/*_review_grading.sql (review_hv_key,
 * review_grade_answer) — sửa ở đây thì PHẢI sửa bên SQL, scripts/test-review.mts so khớp hai bên.
 */

export const MASTERY_STREAK = { mastered: 3, good: 2, toConfirm: 1 } as const;
/** Tổng số bài của sách, cố định — không phụ thuộc dữ liệu đã nạp (bài chưa nạp hiện "Chưa có dữ liệu"). */
export const TOTAL_BOOK_LESSONS = 32;

export type MasteryLevel = 'new' | 'bad' | 'to_confirm' | 'good' | 'mastered';
export type QuestionType = 'K1' | 'E1' | 'K2' | 'E2';
export type ItemType = 'kanji' | 'example';
export const QUESTION_TYPES: readonly QuestionType[] = ['K1', 'E1', 'K2', 'E2'];
export const KANJI_QUESTION_TYPES: readonly QuestionType[] = ['K1', 'K2'];
export const EXAMPLE_QUESTION_TYPES: readonly QuestionType[] = ['E1', 'E2'];

export interface CardState {
  correctCount: number;
  wrongCount: number;
  streak: number;
  masteryLevel: MasteryLevel;
  lastReviewedAt: string | null;
}

export const EMPTY_CARD_STATE: CardState = { correctCount: 0, wrongCount: 0, streak: 0, masteryLevel: 'new', lastReviewedAt: null };

export function calculateMastery(streak: number, wrongCount: number): MasteryLevel {
  if (streak >= MASTERY_STREAK.mastered) return 'mastered';
  if (streak === MASTERY_STREAK.good) return 'good';
  if (streak === MASTERY_STREAK.toConfirm) return 'to_confirm';
  return wrongCount > 0 ? 'bad' : 'new';
}

/** Đúng: streak+1. Sai: streak về 0 (không giữ "đã từng mastered"). */
export function applyAnswer(state: CardState, isCorrect: boolean, nowIso: string): CardState {
  const streak = isCorrect ? state.streak + 1 : 0;
  const correctCount = state.correctCount + (isCorrect ? 1 : 0);
  const wrongCount = state.wrongCount + (isCorrect ? 0 : 1);
  return { correctCount, wrongCount, streak, masteryLevel: calculateMastery(streak, wrongCount), lastReviewedAt: nowIso };
}

// ---------------- Chấm Hán Việt ----------------
// Mỗi âm tiết được quy về khoá "chữ gốc|thanh": bỏ 5 dấu thanh khỏi chuỗi (giữ dấu mũ/trăng/móc vì đó là
// chữ cái), ghi riêng thanh. Nhờ vậy vị trí đặt dấu không quan trọng (hoà ≡ hòa, uý ≡ úy) nhưng THANH thì
// phải đúng (Hỏa ≠ Hóa) và gõ không dấu là sai (hoa ≠ hoà). Hai dấu thanh trong một âm tiết → không hợp lệ.
const TONE_MARKS: Record<string, string> = {
  '̀': 'f', // huyền
  '́': 's', // sắc
  '̃': 'x', // ngã
  '̉': 'r', // hỏi
  '̣': 'j', // nặng
};
const TONE_RE = /[̣̀́̃̉]/g;

/** Khoá so khớp của một âm tiết Hán Việt, hoặc null nếu không hợp lệ (rỗng, nhiều hơn 1 dấu thanh). */
export function hanVietSyllableKey(input: string): string | null {
  const decomposed = input.trim().normalize('NFD');
  if (decomposed === '' || /\s/.test(decomposed)) return null;
  const tones = decomposed.match(TONE_RE) ?? [];
  if (tones.length > 1) return null;
  const base = decomposed.replace(TONE_RE, '').replace(/Đ/g, 'đ').toLowerCase().normalize('NFC');
  const tone = tones[0];
  return `${base}|${tone ? (TONE_MARKS[tone] ?? '') : ''}`;
}

export function splitSyllables(input: string): string[] {
  const t = input.trim();
  return t === '' ? [] : t.split(/\s+/);
}

/**
 * parts[i] = các cách viết chấp nhận được của âm tiết thứ i (K1: 1 âm tiết; E1: mỗi kanji trong từ 1 âm tiết).
 * Đúng khi số âm tiết khớp và từng âm tiết khớp một trong các cách viết.
 */
export function compareHanVietAnswer(userInput: string, parts: readonly (readonly string[])[]): boolean {
  const syllables = splitSyllables(userInput);
  if (parts.length === 0 || syllables.length !== parts.length) return false;
  return syllables.every((s, i) => {
    const key = hanVietSyllableKey(s);
    return key !== null && parts[i].some((form) => hanVietSyllableKey(form) === key);
  });
}

// ---------------- Chấm tiếng Nhật (E2) ----------------
/** NFKC (ｶﾅ nửa độ rộng → toàn độ rộng), bỏ mọi khoảng trắng. KHÔNG gộp hiragana/katakana. */
export function normalizeJapaneseAnswer(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, '');
}

/** Chấp nhận cách đọc kana hoặc đúng dạng chữ (người dùng gõ IME đã đổi ra kanji). */
export function compareJapaneseAnswer(userInput: string, acceptedForms: readonly string[]): boolean {
  const got = normalizeJapaneseAnswer(userInput);
  return got !== '' && acceptedForms.some((f) => normalizeJapaneseAnswer(f) === got);
}

// ---------------- Đáp án E1 từ dữ liệu kanji ----------------
const KANJI_CHAR_RE = /\p{Script=Han}/u;
export const ITERATION_MARK = '々';

export function isKanjiChar(ch: string): boolean {
  return ch === ITERATION_MARK || KANJI_CHAR_RE.test(ch);
}

/**
 * Dựng đáp án Hán Việt cho một từ: mỗi kanji trong từ → danh sách cách viết chấp nhận (bỏ qua kana).
 * 々 lặp lại âm của kanji ngay trước. Trả null nếu có kanji không tra được (câu E1 không áp dụng).
 */
export function hanVietPartsForTerm(term: string, lookup: (kanji: string) => readonly string[] | undefined): string[][] | null {
  const parts: string[][] = [];
  for (const ch of term) {
    if (!isKanjiChar(ch)) continue;
    if (ch === ITERATION_MARK) {
      if (parts.length === 0) return null;
      parts.push([...parts[parts.length - 1]]);
      continue;
    }
    const forms = lookup(ch);
    if (!forms || forms.length === 0) return null;
    parts.push([...forms]);
  }
  return parts.length > 0 ? parts : null;
}

// ---------------- Chọn câu hỏi ----------------
export interface QuizCandidate {
  itemType: ItemType;
  itemId: string;
  applicableQuestionTypes: QuestionType[];
  cardStates: Partial<Record<QuestionType, CardState>>;
}
export type SmartStrategy = 'least_streak' | 'least_accuracy' | 'least_reviewed' | 'unseen_first';
export const SMART_STRATEGIES: readonly SmartStrategy[] = ['least_streak', 'least_accuracy', 'least_reviewed', 'unseen_first'];

export interface QuestionEnvelope {
  itemType: ItemType;
  itemId: string;
  questionType: QuestionType;
}

export function maxQuestionsFor(candidates: readonly QuizCandidate[], questionTypes: readonly QuestionType[] = QUESTION_TYPES): number {
  return candidates.reduce((n, c) => n + c.applicableQuestionTypes.filter((q) => questionTypes.includes(q)).length, 0);
}

/** Danh sách câu (chưa trộn) theo loại được chọn, cắt ở maxQuestions. Không sinh câu cho loại không áp dụng. */
export function buildQuizPlan(
  candidates: readonly QuizCandidate[],
  questionTypes: readonly QuestionType[],
  maxQuestions: number
): QuestionEnvelope[] {
  const out: QuestionEnvelope[] = [];
  const cap = Math.max(0, Math.min(Math.floor(maxQuestions), maxQuestionsFor(candidates, questionTypes)));
  for (const c of candidates) {
    for (const q of c.applicableQuestionTypes) {
      if (out.length >= cap) return out;
      if (questionTypes.includes(q)) out.push({ itemType: c.itemType, itemId: c.itemId, questionType: q });
    }
  }
  return out;
}

function statesOf(c: QuizCandidate): CardState[] {
  return c.applicableQuestionTypes.map((q) => c.cardStates[q] ?? EMPTY_CARD_STATE);
}

/** Điểm ưu tiên (nhỏ = cần ôn trước). Hoà điểm giữ thứ tự đầu vào (sort ổn định) để kết quả xác định. */
function priority(c: QuizCandidate, strategy: SmartStrategy): number {
  const states = statesOf(c);
  if (states.length === 0) return Number.POSITIVE_INFINITY;
  switch (strategy) {
    case 'least_streak':
      return Math.min(...states.map((s) => s.streak));
    case 'least_accuracy': {
      const correct = states.reduce((n, s) => n + s.correctCount, 0);
      const total = states.reduce((n, s) => n + s.correctCount + s.wrongCount, 0);
      // chưa làm lần nào: xếp sau mọi mục đã làm (đã có chiến lược unseen_first riêng cho mục chưa làm)
      return total === 0 ? 2 : correct / total;
    }
    case 'least_reviewed':
      return states.reduce((n, s) => n + s.correctCount + s.wrongCount, 0);
    case 'unseen_first':
      return states.some((s) => s.correctCount + s.wrongCount === 0) ? 0 : 1;
  }
}

export function pickQuizCandidates(candidates: readonly QuizCandidate[], strategy: SmartStrategy, limit: number): QuizCandidate[] {
  return candidates
    .filter((c) => c.applicableQuestionTypes.length > 0)
    .map((c, i) => ({ c, i, p: priority(c, strategy) }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((x) => x.c);
}

/** Vòng % Home = mastered / tổng thẻ; tổng 0 → 0 (không NaN). */
export function masteredRatio(mastered: number, total: number): number {
  return total <= 0 ? 0 : Math.min(1, mastered / total);
}
