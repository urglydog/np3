/**
 * Module "Ôn luyện" (Kanji 512) — logic thuần cho mastery, so khớp đáp án và lập kế hoạch quiz.
 * Theo docs/plans/review-feature.plan.md §5 + Delta 2 ở plan sửa UI (scoreHandwriting).
 * Hàm THUẦN: không đọc đồng hồ nội bộ (nhận nowIso), không DOM/canvas/fs.
 * Bản SQL mirror tương ứng: supabase/migrations/20261006000000_review_schema.sql
 * (normalize_han_viet_syllable / compare_han_viet_answer / review_submit_answer) — hai bên phải
 * cho cùng kết quả trên mọi input (kiểm bằng scripts/test-review-grading-equivalence.mts, M4).
 */

// ============ 1. Mastery ============

export const MASTERY_STREAK = { mastered: 3, good: 2, toConfirm: 1 } as const; // ngưỡng, có thể chỉnh
export const TOTAL_BOOK_LESSONS = 32; // cố định theo cấu trúc sách, KHÔNG phụ thuộc dữ liệu đã seed

export type MasteryLevel = 'new' | 'bad' | 'to_confirm' | 'good' | 'mastered';

export interface CardState {
  correctCount: number;
  wrongCount: number;
  streak: number;
  masteryLevel: MasteryLevel;
  lastReviewedAt: string | null;
}

export function calculateMastery(streak: number, wrongCount: number): MasteryLevel {
  if (streak >= MASTERY_STREAK.mastered) return 'mastered';
  if (streak === MASTERY_STREAK.good) return 'good';
  if (streak === MASTERY_STREAK.toConfirm) return 'to_confirm';
  if (streak === 0 && wrongCount > 0) return 'bad';
  return 'new';
}

/** Áp 1 kết quả trả lời lên trạng thái thẻ. Không đọc đồng hồ — nowIso do caller truyền vào. */
export function applyAnswer(state: CardState, isCorrect: boolean, nowIso: string): CardState {
  const correctCount = isCorrect ? state.correctCount + 1 : state.correctCount;
  const wrongCount = isCorrect ? state.wrongCount : state.wrongCount + 1;
  const streak = isCorrect ? state.streak + 1 : 0;
  return {
    correctCount,
    wrongCount,
    streak,
    masteryLevel: calculateMastery(streak, wrongCount),
    lastReviewedAt: nowIso,
  };
}

// ============ 2. So khớp Hán Việt (bắt buộc đúng dấu thanh, chỉ khoan dung vị trí đặt dấu) ============

// 5 dấu thanh dạng combining sau khi NFD: huyền U+0300, sắc U+0301, ngã U+0303, hỏi U+0309, nặng U+0323.
// Các dấu hình dạng nguyên âm (â/ơ/ư/ă dùng circumflex U+0302, horn U+031B, breve U+0306) KHÔNG nằm
// trong danh sách này vì chúng là CHỮ khác, không phải vị trí đặt dấu thanh.
const TONE_MARKS = new Set(['̀', '́', '̃', '̉', '̣']);

/**
 * Chuẩn hoá 1 âm tiết Hán Việt để so khớp không phân biệt vị trí đặt dấu thanh trong âm tiết
 * (vd "hoà"≡"hòa", "uý"≡"úy") nhưng vẫn phân biệt dấu thanh khác nhau ("Hỏa"≠"Hóa") và KHÔNG chấp
 * nhận thiếu dấu thanh hoàn toàn ("hoa"≠"hoà" vì tập dấu thanh rỗng khác tập có 1 dấu).
 * Thuật toán: NFC + hạ chữ thường + trim -> NFD để tách combining mark -> gom riêng 5 dấu thanh
 * vào 1 chuỗi (không quan tâm thứ tự/vị trí trong âm tiết), còn lại (chữ cái + dấu hình dạng
 * nguyên âm) ghép lại rồi NFC hoá -> trả về "phầnChữ#tậpDấuThanh".
 */
export function normalizeHanVietSyllable(input: string): string {
  const folded = input.normalize('NFC').toLowerCase().trim();
  const nfd = folded.normalize('NFD');
  let base = '';
  let tones = '';
  for (const ch of nfd) {
    if (TONE_MARKS.has(ch)) tones += ch;
    else base += ch;
  }
  return `${base.normalize('NFC')}#${tones}`;
}

/**
 * So khớp đáp án Hán Việt của người dùng với danh sách các dạng được chấp nhận.
 * Tách theo khoảng trắng để chấm từng âm tiết (phục vụ E1 — từ ghép nhiều chữ); false nếu số âm
 * tiết người dùng gõ không khớp số âm tiết của dạng đang so (tức không khớp số chữ trong term).
 */
export function compareHanVietAnswer(userInput: string, acceptedForms: string[]): boolean {
  if (userInput == null || acceptedForms == null) return false;
  const userSyllables = userInput.trim().split(/\s+/).filter((s) => s.length > 0);
  if (userSyllables.length === 0) return false;
  for (const accepted of acceptedForms) {
    if (!accepted || accepted.trim().length === 0) continue;
    const acceptedSyllables = accepted.trim().split(/\s+/).filter((s) => s.length > 0);
    if (acceptedSyllables.length !== userSyllables.length) continue; // số âm tiết không khớp -> không thể khớp
    const allMatch = userSyllables.every(
      (s, i) => normalizeHanVietSyllable(s) === normalizeHanVietSyllable(acceptedSyllables[i]),
    );
    if (allMatch) return true;
  }
  return false;
}

// ============ 3. So khớp tiếng Nhật (E2 — chấm chính xác sau NFKC) ============

export function normalizeJapaneseAnswer(input: string): string {
  return input.normalize('NFKC').trim();
}

export function compareJapaneseAnswer(userInput: string, correctReading: string): boolean {
  if (userInput == null || correctReading == null) return false;
  return normalizeJapaneseAnswer(userInput) === normalizeJapaneseAnswer(correctReading);
}

// ============ 4. Smart scope / quiz plan ============

export type QuestionType = 'K1' | 'E1' | 'K2' | 'E2';
export type ItemType = 'kanji' | 'example';

export interface QuizCandidate {
  itemType: ItemType;
  itemId: string;
  applicableQuestionTypes: QuestionType[];
  cardStates: Partial<Record<QuestionType, CardState>>;
}

export type SmartStrategy = 'least_streak' | 'least_accuracy' | 'least_reviewed' | 'unseen_first';

const EMPTY_STATE: CardState = { correctCount: 0, wrongCount: 0, streak: 0, masteryLevel: 'new', lastReviewedAt: null };

function statesOf(c: QuizCandidate): CardState[] {
  return c.applicableQuestionTypes.map((qt) => c.cardStates[qt] ?? EMPTY_STATE);
}

function totalAttempts(states: CardState[]): number {
  return states.reduce((sum, s) => sum + s.correctCount + s.wrongCount, 0);
}

function avgStreak(states: CardState[]): number {
  if (states.length === 0) return 0;
  return states.reduce((sum, s) => sum + s.streak, 0) / states.length;
}

/** accuracy trung bình; nếu mục chưa có bất kỳ lần trả lời nào, coi như accuracy=1 (không chưa luyện,
 *  "chưa luyện" là việc của strategy unseen_first/least_reviewed, không phải least_accuracy). */
function avgAccuracy(states: CardState[]): number {
  if (totalAttempts(states) === 0) return 1;
  const accs = states.map((s) => {
    const t = s.correctCount + s.wrongCount;
    return t === 0 ? 1 : s.correctCount / t;
  });
  return accs.reduce((a, b) => a + b, 0) / accs.length;
}

/** Sắp xếp (ổn định) ứng viên theo 1 chiến lược "smart scope" rồi lấy tối đa `limit` mục đầu. */
export function pickQuizCandidates(candidates: QuizCandidate[], strategy: SmartStrategy, limit: number): QuizCandidate[] {
  const withKey = candidates.map((c, idx) => ({ c, idx, states: statesOf(c) }));
  let sorted: typeof withKey;
  switch (strategy) {
    case 'least_streak':
      sorted = [...withKey].sort((a, b) => avgStreak(a.states) - avgStreak(b.states) || a.idx - b.idx);
      break;
    case 'least_accuracy':
      sorted = [...withKey].sort((a, b) => avgAccuracy(a.states) - avgAccuracy(b.states) || a.idx - b.idx);
      break;
    case 'least_reviewed':
      sorted = [...withKey].sort((a, b) => totalAttempts(a.states) - totalAttempts(b.states) || a.idx - b.idx);
      break;
    case 'unseen_first':
      sorted = [...withKey].sort((a, b) => {
        const aUnseen = totalAttempts(a.states) === 0 ? 0 : 1;
        const bUnseen = totalAttempts(b.states) === 0 ? 0 : 1;
        return aUnseen - bUnseen || a.idx - b.idx;
      });
      break;
  }
  return sorted.slice(0, Math.max(0, limit)).map((x) => x.c);
}

/** Trần số câu hỏi có thể sinh = tổng số loại câu áp dụng của mọi ứng viên. */
export function maxQuestionsFor(candidates: QuizCandidate[]): number {
  return candidates.reduce((sum, c) => sum + c.applicableQuestionTypes.length, 0);
}

export interface QuestionEnvelope {
  itemType: ItemType;
  itemId: string;
  questionType: QuestionType;
}

/** Sinh danh sách câu hỏi: chỉ loại người dùng chọn, chỉ loại áp dụng cho từng mục, cap ở maxQuestions. */
export function buildQuizPlan(candidates: QuizCandidate[], questionTypes: QuestionType[], maxQuestions: number): QuestionEnvelope[] {
  const wanted = new Set(questionTypes);
  const out: QuestionEnvelope[] = [];
  const cap = Math.max(0, Math.min(maxQuestions, maxQuestionsFor(candidates)));
  for (const c of candidates) {
    for (const qt of c.applicableQuestionTypes) {
      if (!wanted.has(qt)) continue;
      if (out.length >= cap) return out;
      out.push({ itemType: c.itemType, itemId: c.itemId, questionType: qt });
    }
  }
  return out;
}

/** Tỉ lệ mastered trên Home. total=0 -> trả 0 (không NaN). */
export function masteredRatio(states: CardState[]): number {
  if (states.length === 0) return 0;
  const mastered = states.filter((s) => s.masteryLevel === 'mastered').length;
  return mastered / states.length;
}

// ============ 5. Chấm viết tay K2 (Delta 2 — heuristic hình học, không OCR/ML) ============

// Ngưỡng tự chấm ĐÚNG khi độ khớp rất cao — bảo thủ, ưu tiên rơi về tự xác nhận khi không chắc
// (CLAUDE.md bất biến #4(c): "không bao giờ tự đánh dấu SAI bằng máy, chỉ tự đánh dấu ĐÚNG khi rất chắc").
export const K2_AUTO_CORRECT_THRESHOLD = 0.85;

// Số điểm resample cố định mỗi nét trước khi so khớp.
const RESAMPLE_POINTS = 16;

// Khoảng cách Euclid trung bình (trên mặt phẳng đã chuẩn hoá bounding box 0..1) được coi là "lệch
// hoàn toàn" (similarity ~ 0). 0.5 ~ một nửa đường chéo của hình vuông đơn vị (đường chéo ~1.414),
// chọn con số này vì 2 nét trông "khá giống nhau" vẫn có thể lệch vài phần mười do run tay — đây là
// tham số có thể tinh chỉnh sau khi có dữ liệu thật, không phải hằng số tuyệt đối.
const MAX_EXPECTED_DIST = 0.5;

export interface StrokePoint {
  x: number;
  y: number;
}
// 1 nét = chuỗi điểm đã trích xuất từ canvas/KanjiVG (chưa resample).
export type StrokePath = StrokePoint[];

export interface HandwritingScore {
  score: number; // 0..1
  strokeCountMatch: boolean;
  autoCorrect: boolean;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Resample 1 nét về đúng N điểm cố định, chọn theo CHỈ SỐ điểm hiện có (nearest-index), KHÔNG nội
 * suy theo cung chính xác (đơn giản hoá có chủ đích, đủ dùng cho heuristic nhẹ — ghi rõ giới hạn:
 * nếu các điểm gốc phân bố không đều theo thời gian vẽ, resample kiểu này có thể lệch nhẹ so với
 * resample theo độ dài cung thật; chấp nhận được vì ngưỡng auto-correct đã rất bảo thủ).
 */
function resample(path: StrokePath, n: number = RESAMPLE_POINTS): StrokePoint[] {
  if (path.length === 0) return Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  if (path.length === 1) return Array.from({ length: n }, () => ({ ...path[0] }));
  const out: StrokePoint[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (path.length - 1)) / (n - 1));
    out.push({ ...path[idx] });
  }
  return out;
}

/** Chuẩn hoá bounding box của 1 nét (đã resample) về [0,1]x[0,1], co giãn theo kích thước thật. */
function normalizeBBox(points: StrokePoint[]): StrokePoint[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  return points.map((p) => ({
    x: w > 0 ? (p.x - minX) / w : 0,
    y: h > 0 ? (p.y - minY) / h : 0,
  }));
}

function strokeSimilarity(a: StrokePoint[], b: StrokePoint[]): number {
  let sumDist = 0;
  for (let i = 0; i < a.length; i++) {
    const dx = a[i].x - b[i].x;
    const dy = a[i].y - b[i].y;
    sumDist += Math.sqrt(dx * dx + dy * dy);
  }
  const avgDist = sumDist / a.length;
  return 1 - clamp01(avgDist / MAX_EXPECTED_DIST);
}

/**
 * Chấm điểm khớp hình học giữa nét vẽ của người dùng (`drawn`) và nét chuẩn KanjiVG (`reference`).
 * Hàm THUẦN — không đọc DOM/canvas, nhận toạ độ đã trích xuất sẵn (test được bằng fixture tĩnh).
 * Tuyệt đối KHÔNG autoCorrect khi số nét không khớp, bất kể hình dạng từng nét gần giống thế nào.
 */
export function scoreHandwriting(drawn: StrokePath[], reference: StrokePath[]): HandwritingScore {
  const strokeCountMatch = drawn.length === reference.length;
  const pairCount = Math.min(drawn.length, reference.length);

  let score = 0;
  if (pairCount > 0) {
    let sumSimilarity = 0;
    for (let i = 0; i < pairCount; i++) {
      const a = normalizeBBox(resample(drawn[i]));
      const b = normalizeBBox(resample(reference[i]));
      sumSimilarity += strokeSimilarity(a, b);
    }
    score = sumSimilarity / pairCount;
    if (!strokeCountMatch) score *= 0.5; // phạt số nét sai, không bao giờ đủ để auto-correct
  }

  return {
    score,
    strokeCountMatch,
    autoCorrect: score >= K2_AUTO_CORRECT_THRESHOLD && strokeCountMatch,
  };
}
