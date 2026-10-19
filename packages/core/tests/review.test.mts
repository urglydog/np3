// Kiểm tra module "Ôn luyện": mastery, so khớp Hán Việt/Nhật, smart scope, quiz plan, scoreHandwriting (K2).
import {
  calculateMastery,
  applyAnswer,
  normalizeHanVietSyllable,
  compareHanVietAnswer,
  compareJapaneseAnswer,
  pickQuizCandidates,
  maxQuestionsFor,
  buildQuizPlan,
  masteredRatio,
  scoreHandwriting,
  K2_AUTO_CORRECT_THRESHOLD,
  type CardState,
  type QuizCandidate,
} from '../src/review';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};
const ok = (label: string, cond: boolean) => {
  checks++;
  if (!cond) {
    fails++;
    console.error(`FAIL ${label}`);
  }
};

const freshState: CardState = { correctCount: 0, wrongCount: 0, streak: 0, masteryLevel: 'new', lastReviewedAt: null };

// ============ calculateMastery: 5 mức + case biên streak=3 vs 2 ============
eq('calculateMastery streak=0,wrong=0 -> new', calculateMastery(0, 0), 'new');
eq('calculateMastery streak=0,wrong=1 -> bad', calculateMastery(0, 1), 'bad');
eq('calculateMastery streak=1 -> to_confirm', calculateMastery(1, 0), 'to_confirm');
eq('calculateMastery streak=2 -> good', calculateMastery(2, 0), 'good');
eq('calculateMastery streak=3 -> mastered', calculateMastery(3, 5), 'mastered');
eq('calculateMastery biên streak=2 (không phải mastered)', calculateMastery(2, 3), 'good');
eq('calculateMastery biên streak=3 (đủ mastered)', calculateMastery(3, 0), 'mastered');

// ============ applyAnswer: đúng liên tiếp 3 lần -> mastered; sai sau mastered -> streak=0, bad ============
{
  let s = freshState;
  s = applyAnswer(s, true, '2026-01-01T00:00:00Z');
  s = applyAnswer(s, true, '2026-01-02T00:00:00Z');
  s = applyAnswer(s, true, '2026-01-03T00:00:00Z');
  eq('applyAnswer 3 lần đúng -> mastered', s.masteryLevel, 'mastered');
  eq('applyAnswer 3 lần đúng -> streak=3', s.streak, 3);
  s = applyAnswer(s, false, '2026-01-04T00:00:00Z');
  eq('applyAnswer sai sau mastered -> streak về 0', s.streak, 0);
  eq('applyAnswer sai sau mastered -> bad (không giữ mastered cũ)', s.masteryLevel, 'bad');
  eq('applyAnswer sai -> wrongCount tăng', s.wrongCount, 1);
}

// ============ Hán Việt — bảng test §5 plan gốc, tính tay trước khi assert ============
// hoà vs hòa: "hoà" -> NFD: h,o,à(=a+U+0300) -> base "hoa", tones "̀" -> "hoa#̀"
//             "hòa" -> h,ò(=o+U+0300),a -> base "hoa", tones "̀" -> "hoa#̀" -> BẰNG NHAU
eq('normalizeHanVietSyllable hoà', normalizeHanVietSyllable('hoà'), 'hoa#̀');
eq('normalizeHanVietSyllable hòa', normalizeHanVietSyllable('hòa'), 'hoa#̀');
ok('hoà ≡ hòa (khớp)', compareHanVietAnswer('hoà', ['hòa']));

// uý vs úy: "uý" -> u,ý(=y+U+0301) -> base "uy", tones "́"
//           "úy" -> ú(=u+U+0301),y -> base "uy", tones "́" -> BẰNG NHAU
ok('uý ≡ úy (khớp)', compareHanVietAnswer('uý', ['úy']));

// Hỏa vs Hóa: "hỏa" -> h,ỏ(=o+U+0309 hỏi),a -> base "hoa", tones "̉"
//             "hóa" -> h,ó(=o+U+0301 sắc),a -> base "hoa", tones "́" -> KHÁC THANH -> không khớp
ok('Hỏa ≠ Hóa (khác thanh hỏi/sắc, không khớp)', !compareHanVietAnswer('Hỏa', ['Hóa']));

// Nhất vs " nhất ": lowercase+trim giống nhau -> normalize giống nhau tuyệt đối -> khớp
ok('Nhất ≡ " nhất " (case-fold + trim, khớp)', compareHanVietAnswer('Nhất', [' nhất ']));

// hanh vs hành: "hanh" không dấu thanh -> tones rỗng "" ; "hành" -> à -> tones "̀" -> khác -> không khớp
eq('normalizeHanVietSyllable hanh (không dấu)', normalizeHanVietSyllable('hanh'), 'hanh#');
ok('hanh ≠ hành (thiếu dấu thanh hoàn toàn, không khớp)', !compareHanVietAnswer('hanh', ['hành']));

// hoa vs hoà: "hoa" tones rỗng, "hoà" tones "̀" -> khác -> không khớp
ok('hoa ≠ hoà (thiếu dấu thanh, không khớp)', !compareHanVietAnswer('hoa', ['hoà']));

// trươc vs trước: "trươc" chỉ có ư (horn, không phải dấu thanh) -> tones rỗng
//                  "trước" có ớ = o+horn+U+0301(sắc) -> tones "́" -> khác -> không khớp
ok('trươc ≠ trước (thiếu dấu thanh, không khớp)', !compareHanVietAnswer('trươc', ['trước']));

// Số âm tiết không khớp số chữ trong term -> false ngay cả khi từng âm tiết riêng lẻ có thể khớp
ok('số âm tiết không khớp -> false', !compareHanVietAnswer('hoa binh', ['hoà']));

// ============ Nhật (E2) — NFKC cơ bản ============
ok('compareJapaneseAnswer NFKC cơ bản (fullwidth số/khoảng trắng)', compareJapaneseAnswer('もの', 'もの'));
ok('compareJapaneseAnswer khác nhau -> false', !compareJapaneseAnswer('もの', 'やま'));
ok('compareJapaneseAnswer NFKC chuẩn hoá fullwidth latin', compareJapaneseAnswer('ＡＢＣ', 'ABC'));

// ============ maxQuestionsFor / buildQuizPlan ============
{
  const kanjiOk: QuizCandidate = {
    itemType: 'kanji',
    itemId: 'k1',
    applicableQuestionTypes: ['K1', 'K2'],
    cardStates: {},
  };
  const kanjiNotApplicable: QuizCandidate = {
    itemType: 'kanji',
    itemId: 'k2-nokanji', // vd is_kanji=false hoặc chưa confirmed -> app lọc applicableQuestionTypes rỗng
    applicableQuestionTypes: [],
    cardStates: {},
  };
  const example1: QuizCandidate = {
    itemType: 'example',
    itemId: 'e1',
    applicableQuestionTypes: ['E1', 'E2'],
    cardStates: {},
  };
  const all = [kanjiOk, kanjiNotApplicable, example1];
  eq('maxQuestionsFor: 2(kanjiOk) + 0(không áp dụng) + 2(example1) = 4', maxQuestionsFor(all), 4);

  const plan = buildQuizPlan(all, ['K1', 'K2', 'E1', 'E2'], 4);
  eq('buildQuizPlan: đủ 4 câu, loại kanji không áp dụng không sinh câu', plan.length, 4);
  ok('buildQuizPlan không chứa itemId của kanjiNotApplicable', !plan.some((p) => p.itemId === 'k2-nokanji'));

  const planCapped = buildQuizPlan(all, ['K1', 'K2', 'E1', 'E2'], 2);
  eq('buildQuizPlan cap ở 2 dù trần cao hơn', planCapped.length, 2);

  const planOnlyE = buildQuizPlan(all, ['E1'], 10);
  eq('buildQuizPlan chỉ sinh loại được chọn (E1)', planOnlyE, [{ itemType: 'example', itemId: 'e1', questionType: 'E1' }]);
}

// ============ pickQuizCandidates — thứ tự theo từng strategy trên dữ liệu giả cố định ============
{
  // A: chưa luyện gì (streak=0, 0 attempt) ở cả 2 loại áp dụng.
  // B: đã luyện nhiều, độ chính xác thấp (streak=0 nhưng đã có wrongCount, avgAccuracy thấp).
  // C: đã luyện ít, độ chính xác cao (streak cao, ít attempt nhưng toàn đúng).
  const a: QuizCandidate = {
    itemType: 'kanji',
    itemId: 'A',
    applicableQuestionTypes: ['K1'],
    cardStates: {},
  };
  const b: QuizCandidate = {
    itemType: 'kanji',
    itemId: 'B',
    applicableQuestionTypes: ['K1'],
    cardStates: { K1: { correctCount: 1, wrongCount: 9, streak: 0, masteryLevel: 'bad', lastReviewedAt: '2026-01-01T00:00:00Z' } },
    // avgAccuracy = 1/10 = 0.1 ; totalAttempts=10 ; avgStreak=0
  };
  const c: QuizCandidate = {
    itemType: 'kanji',
    itemId: 'C',
    applicableQuestionTypes: ['K1'],
    cardStates: { K1: { correctCount: 2, wrongCount: 0, streak: 2, masteryLevel: 'good', lastReviewedAt: '2026-01-01T00:00:00Z' } },
    // avgAccuracy = 2/2 = 1 ; totalAttempts=2 ; avgStreak=2
  };
  const fixture = [a, b, c];

  // least_streak: avgStreak A=0, B=0, C=2 -> A,B (giữ thứ tự gốc, tie) rồi C
  eq('pickQuizCandidates least_streak', pickQuizCandidates(fixture, 'least_streak', 3).map((x) => x.itemId), ['A', 'B', 'C']);

  // least_accuracy: A chưa có attempt -> avgAccuracy=1 (coi như không ưu tiên ở strategy này);
  // B avgAccuracy=0.1 (thấp nhất) -> B trước; C avgAccuracy=1 ; A và C tie ở 1, giữ thứ tự gốc (A trước C)
  eq('pickQuizCandidates least_accuracy', pickQuizCandidates(fixture, 'least_accuracy', 3).map((x) => x.itemId), ['B', 'A', 'C']);

  // least_reviewed: totalAttempts A=0, B=10, C=2 -> A, C, B
  eq('pickQuizCandidates least_reviewed', pickQuizCandidates(fixture, 'least_reviewed', 3).map((x) => x.itemId), ['A', 'C', 'B']);

  // unseen_first: A chưa luyện (0 attempt) lên đầu, B và C đã luyện giữ thứ tự gốc theo sau
  eq('pickQuizCandidates unseen_first', pickQuizCandidates(fixture, 'unseen_first', 3).map((x) => x.itemId), ['A', 'B', 'C']);

  // limit cắt đúng số lượng
  eq('pickQuizCandidates limit=1', pickQuizCandidates(fixture, 'least_reviewed', 1).map((x) => x.itemId), ['A']);
}

// ============ masteredRatio ============
eq('masteredRatio total=0 -> 0 (không NaN)', masteredRatio([]), 0);
{
  const states: CardState[] = [
    { ...freshState, masteryLevel: 'mastered' },
    { ...freshState, masteryLevel: 'mastered' },
    { ...freshState, masteryLevel: 'good' },
    { ...freshState, masteryLevel: 'new' },
  ];
  eq('masteredRatio 2/4 = 0.5', masteredRatio(states), 0.5);
}

// ============ scoreHandwriting (K2 — Delta 2) ============
{
  // 2 nét giống nhau tuyệt đối (đường chéo đơn giản) -> trùng khít 100%.
  const strokeA = [
    { x: 0, y: 0 },
    { x: 5, y: 5 },
    { x: 10, y: 10 },
  ];
  const strokeB = [
    { x: 0, y: 10 },
    { x: 10, y: 0 },
  ];
  const reference = [strokeA, strokeB];
  const drawnIdentical = [
    strokeA.map((p) => ({ ...p })),
    strokeB.map((p) => ({ ...p })),
  ];
  const r1 = scoreHandwriting(drawnIdentical, reference);
  ok('scoreHandwriting nét trùng khít: strokeCountMatch=true', r1.strokeCountMatch);
  ok('scoreHandwriting nét trùng khít: score gần 1', r1.score > 0.99);
  ok('scoreHandwriting nét trùng khít: autoCorrect=true', r1.autoCorrect);
  ok('K2_AUTO_CORRECT_THRESHOLD hợp lý (0.85)', K2_AUTO_CORRECT_THRESHOLD === 0.85);

  // Lệch nhiều: reference là 2 nét chéo (strokeA: chéo chính, strokeB: chéo phụ); drawnFar là 1 nét
  // NGANG và 1 nét DỌC — sau khi chuẩn hoá bounding box về [0,1]x[0,1], mỗi điểm tương ứng lệch ~0.5
  // đến 1 theo 1 trục, trung bình khoảng cách ~0.5 => similarity ~0 cho cả 2 nét => dưới ngưỡng rõ ràng.
  const drawnFar = [
    [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ], // nét ngang thẳng, so với strokeA (chéo (0,0)->(10,10))
    [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ], // nét dọc thẳng, so với strokeB (chéo (0,10)->(10,0))
  ];
  const r2 = scoreHandwriting(drawnFar, reference);
  ok('scoreHandwriting lệch nhiều: strokeCountMatch=true (vẫn đủ số nét)', r2.strokeCountMatch);
  ok('scoreHandwriting lệch nhiều: autoCorrect=false', !r2.autoCorrect);

  // Số nét SAI (drawn 2 nét, reference 3 nét) dù 2 nét đầu hệt reference -> autoCorrect PHẢI false,
  // đây là bất biến quan trọng nhất (không bao giờ auto-correct khi số nét không khớp).
  const referenceThreeStrokes = [strokeA, strokeB, strokeA.map((p) => ({ x: p.x + 1, y: p.y + 1 }))];
  const drawnTwoStrokesSameShape = [strokeA.map((p) => ({ ...p })), strokeB.map((p) => ({ ...p }))];
  const r3 = scoreHandwriting(drawnTwoStrokesSameShape, referenceThreeStrokes);
  ok('scoreHandwriting số nét sai: strokeCountMatch=false', !r3.strokeCountMatch);
  ok('scoreHandwriting số nét sai: autoCorrect=false DÙ hình dạng 2 nét đầu giống hệt', !r3.autoCorrect);

  // Trường hợp rỗng (không vẽ gì) không được crash, không NaN.
  const r4 = scoreHandwriting([], []);
  eq('scoreHandwriting cả 2 rỗng: strokeCountMatch=true', r4.strokeCountMatch, true);
  eq('scoreHandwriting cả 2 rỗng: score=0 (không có gì để so)', r4.score, 0);
  ok('scoreHandwriting cả 2 rỗng: không NaN', Number.isFinite(r4.score));
}

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
