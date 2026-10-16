// Kiểm tra module Ôn luyện: mức thuộc bài, chấm Hán Việt/tiếng Nhật, đáp án E1, chọn câu hỏi.
import {
  applyAnswer,
  buildQuizPlan,
  calculateMastery,
  compareHanVietAnswer,
  compareJapaneseAnswer,
  EMPTY_CARD_STATE,
  hanVietPartsForTerm,
  hanVietSyllableKey,
  masteredRatio,
  maxQuestionsFor,
  pickQuizCandidates,
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

// ---------- calculateMastery: đủ 5 mức + biên ----------
eq('mastery new', calculateMastery(0, 0), 'new');
eq('mastery bad', calculateMastery(0, 2), 'bad');
eq('mastery to_confirm', calculateMastery(1, 5), 'to_confirm');
eq('mastery good (streak 2)', calculateMastery(2, 0), 'good');
eq('mastery mastered (streak 3)', calculateMastery(3, 0), 'mastered');
eq('mastery mastered (streak 7)', calculateMastery(7, 1), 'mastered');

// ---------- applyAnswer ----------
{
  const now = '2026-10-16T00:00:00.000Z';
  let s: CardState = EMPTY_CARD_STATE;
  s = applyAnswer(s, true, now);
  s = applyAnswer(s, true, now);
  s = applyAnswer(s, true, now);
  eq('3 lần đúng liên tiếp → mastered', [s.masteryLevel, s.streak, s.correctCount], ['mastered', 3, 3]);
  s = applyAnswer(s, false, now);
  eq('sai sau mastered → bad, streak 0', [s.masteryLevel, s.streak, s.wrongCount, s.correctCount], ['bad', 0, 1, 3]);
  eq('applyAnswer ghi lastReviewedAt từ tham số', s.lastReviewedAt, now);
  eq('applyAnswer không sửa state cũ', EMPTY_CARD_STATE.streak, 0);
}

// ---------- Hán Việt: bảng quyết định 2.1.1 của plan ----------
const hv = (a: string, b: string) => compareHanVietAnswer(a, [[b]]);
eq('hoà ≡ hòa (chỉ khác vị trí dấu)', hv('hoà', 'hòa'), true);
eq('uý ≡ úy', hv('uý', 'úy'), true);
eq('Hỏa ≠ Hóa (khác thanh)', hv('Hỏa', 'Hóa'), false);
eq('Nhất ≡ " nhất " (hoa thường + trim)', hv(' nhất ', 'Nhất'), true);
eq('hanh ≠ hành (gõ không dấu)', hv('hanh', 'hành'), false);
eq('hoa ≠ hoà (thiếu thanh)', hv('hoa', 'hoà'), false);
eq('trươc ≠ trước (thiếu thanh)', hv('trươc', 'trước'), false);
eq('nhan ≠ Nhân (thiếu dấu mũ là sai chữ)', hv('nhan', 'Nhân'), false);
eq('dai ≠ Đại (Đ là chữ cái riêng)', hv('dại', 'Đại'), false);
eq('ĐẠI ≡ Đại (hoa toàn bộ)', hv('ĐẠI', 'Đại'), true);
eq('Nhân ≡ nhân (thanh ngang)', hv('nhân', 'Nhân'), true);
eq('dạng tổ hợp (NFD) ≡ dựng sẵn (NFC)', hv('Nhất', 'Nhất'), true);
eq('hai dấu thanh trong một âm tiết → sai', hv('hoàá', 'hoà'), false);
eq('rỗng → sai', hv('   ', 'Nhất'), false);
eq('key null khi rỗng', hanVietSyllableKey(''), null);
eq('key thanh ngang', hanVietSyllableKey('Nhân'), 'nhân|');
eq('key hoà = key hòa', hanVietSyllableKey('hoà') === hanVietSyllableKey('hòa'), true);
eq('Lí ≠ Lý nếu không có trong danh sách chấp nhận', hv('Lí', 'Lý'), false);
eq('nhiều cách viết chấp nhận: Bổn đúng khi accepted có Bổn', compareHanVietAnswer('bổn', [['Bản', 'Bổn']]), true);
// E1 nhiều âm tiết
const parts = [['Nhất'], ['Thời', 'Thì']];
eq('E1 đúng đủ âm tiết', compareHanVietAnswer('nhất thời', parts), true);
eq('E1 dùng cách viết chấp nhận', compareHanVietAnswer('Nhất Thì', parts), true);
eq('E1 nhiều khoảng trắng vẫn đúng', compareHanVietAnswer('  nhất   thời ', parts), true);
eq('E1 thiếu âm tiết → sai', compareHanVietAnswer('nhất', parts), false);
eq('E1 thừa âm tiết → sai', compareHanVietAnswer('nhất thời gian', parts), false);
eq('E1 sai thứ tự → sai', compareHanVietAnswer('thời nhất', parts), false);
eq('parts rỗng → luôn sai', compareHanVietAnswer('', []), false);

// ---------- Tiếng Nhật (E2) ----------
eq('E2 đúng kana', compareJapaneseAnswer('ひとつ', ['ひとつ', '一つ']), true);
eq('E2 gõ IME ra kanji vẫn đúng', compareJapaneseAnswer('一つ', ['ひとつ', '一つ']), true);
eq('E2 khoảng trắng (cả toàn độ rộng) bị bỏ', compareJapaneseAnswer(' ひと　つ ', ['ひとつ']), true);
eq('E2 katakana nửa độ rộng → NFKC', compareJapaneseAnswer('ﾓﾉ', ['モノ']), true);
eq('E2 không gộp hiragana/katakana', compareJapaneseAnswer('もの', ['モノ']), false);
eq('E2 sai', compareJapaneseAnswer('ふたつ', ['ひとつ', '一つ']), false);
eq('E2 rỗng → sai', compareJapaneseAnswer('  ', ['']), false);

// ---------- hanVietPartsForTerm ----------
{
  const dict: Record<string, string[]> = { 一: ['Nhất'], 時: ['Thời', 'Thì'], 人: ['Nhân'] };
  const lookup = (k: string) => dict[k];
  eq('bỏ qua kana', hanVietPartsForTerm('一つ', lookup), [['Nhất']]);
  eq('nhiều kanji, giữ cách viết chấp nhận', hanVietPartsForTerm('一時', lookup), [['Nhất'], ['Thời', 'Thì']]);
  eq('々 lặp âm kanji trước', hanVietPartsForTerm('人々', lookup), [['Nhân'], ['Nhân']]);
  eq('々 đứng đầu → null', hanVietPartsForTerm('々', lookup), null);
  eq('kanji không tra được → null', hanVietPartsForTerm('一鬱', lookup), null);
  eq('không có kanji nào → null', hanVietPartsForTerm('ひとつ', lookup), null);
}

// ---------- maxQuestionsFor / buildQuizPlan ----------
const st = (streak: number, correct: number, wrong: number): CardState => ({
  correctCount: correct,
  wrongCount: wrong,
  streak,
  masteryLevel: calculateMastery(streak, wrong),
  lastReviewedAt: null,
});
const cands: QuizCandidate[] = [
  { itemType: 'kanji', itemId: 'k1', applicableQuestionTypes: ['K1', 'K2'], cardStates: { K1: st(3, 3, 0), K2: st(2, 2, 0) } },
  { itemType: 'kanji', itemId: 'k2', applicableQuestionTypes: [], cardStates: {} }, // chờ xác nhận / 々
  { itemType: 'example', itemId: 'e1', applicableQuestionTypes: ['E1', 'E2'], cardStates: { E1: st(0, 1, 4) } },
  { itemType: 'example', itemId: 'e2', applicableQuestionTypes: ['E2'], cardStates: {} }, // không có đáp án E1
];
eq('maxQuestionsFor = Σ loại áp dụng', maxQuestionsFor(cands), 5);
eq('maxQuestionsFor theo loại được chọn', maxQuestionsFor(cands, ['K1', 'E2']), 3);
eq('buildQuizPlan không sinh câu cho mục không áp dụng', buildQuizPlan(cands, ['K1', 'K2', 'E1', 'E2'], 99).length, 5);
eq('buildQuizPlan cắt theo maxQuestions', buildQuizPlan(cands, ['K1', 'K2', 'E1', 'E2'], 2), [
  { itemType: 'kanji', itemId: 'k1', questionType: 'K1' },
  { itemType: 'kanji', itemId: 'k1', questionType: 'K2' },
]);
eq('buildQuizPlan lọc loại câu', buildQuizPlan(cands, ['E1'], 10), [{ itemType: 'example', itemId: 'e1', questionType: 'E1' }]);
eq('buildQuizPlan max âm → rỗng', buildQuizPlan(cands, ['K1'], -3), []);

// ---------- pickQuizCandidates ----------
const ids = (xs: QuizCandidate[]) => xs.map((c) => c.itemId);
eq('least_streak', ids(pickQuizCandidates(cands, 'least_streak', 10)), ['e1', 'e2', 'k1']);
// e1 đúng 1/5 = 0.2 < k1 5/5; e2 chưa làm lần nào → xếp cuối
eq('least_accuracy (mục chưa làm xếp sau)', ids(pickQuizCandidates(cands, 'least_accuracy', 10)), ['e1', 'k1', 'e2']);
// k1 và e1 cùng 5 lượt → giữ thứ tự đầu vào
eq('least_reviewed (hoà giữ thứ tự đầu vào)', ids(pickQuizCandidates(cands, 'least_reviewed', 10)), ['e2', 'k1', 'e1']);
eq('unseen_first', ids(pickQuizCandidates(cands, 'unseen_first', 10)), ['e1', 'e2', 'k1']);
eq('limit cắt', ids(pickQuizCandidates(cands, 'least_reviewed', 1)), ['e2']);
eq('loại mục không có loại câu nào', ids(pickQuizCandidates(cands, 'least_streak', 10)).includes('k2'), false);

// ---------- masteredRatio ----------
eq('ratio total 0 → 0', masteredRatio(0, 0), 0);
eq('ratio 1/4', masteredRatio(1, 4), 0.25);

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
