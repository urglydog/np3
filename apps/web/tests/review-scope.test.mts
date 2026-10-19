// Kiểm tra parse phạm vi/tham số phiên luyện và dựng candidates (module Ôn luyện).
import { buildCandidates, countByType, parseQuizParams, parseScope, restrictToTypes, scopeToParam, type CardStateRow, type CatalogRow } from '../src/lib/review-scope';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

// ---------- parseScope ----------
eq('lesson:3', parseScope('lesson:3'), { kind: 'lesson', lesson: 3 });
eq('lesson:0 → null', parseScope('lesson:0'), null);
eq('lesson:33 → null', parseScope('lesson:33'), null);
eq('lesson:1.5 → null', parseScope('lesson:1.5'), null);
eq('list uuid', parseScope('list:00000000-0000-0000-0000-00000000000a'), { kind: 'list', listIds: ['00000000-0000-0000-0000-00000000000a'] });
eq('list nhiều uuid', parseScope('list:00000000-0000-0000-0000-00000000000a,00000000-0000-0000-0000-00000000000b'), {
  kind: 'list',
  listIds: ['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'],
});
eq('list rác → null', parseScope("list:1' or 1=1"), null);
eq('kanji nhiều mã, bỏ trùng, hạ chữ thường', parseScope('kanji:04E00.04e8c.04e00'), { kind: 'kanji', hexes: ['04e00', '04e8c'] });
eq('kanji mã rác → null', parseScope('kanji:04e00.zz'), null);
eq('kanji quá 64 mã → null', parseScope(`kanji:${Array.from({ length: 65 }, (_, i) => (0x4e00 + i).toString(16).padStart(5, '0')).join('.')}`), null);
eq('smart hợp lệ', parseScope('smart:unseen_first'), { kind: 'smart', strategy: 'unseen_first' });
eq('smart lạ → null', parseScope('smart:random'), null);
eq('không có dấu : → null', parseScope('lesson3'), null);
eq('rỗng → null', parseScope(undefined), null);
for (const raw of ['lesson:12', 'list:00000000-0000-0000-0000-00000000000a', 'kanji:04e00.04e8c', 'smart:least_streak']) {
  eq(`scopeToParam ∘ parseScope giữ nguyên ${raw}`, scopeToParam(parseScope(raw)!), raw);
}

// ---------- parseQuizParams ----------
eq('params hợp lệ', parseQuizParams({ scope: 'lesson:2', types: 'K1,E2,K1', n: '20' }), {
  ok: true,
  value: { scope: { kind: 'lesson', lesson: 2 }, types: ['K1', 'E2'], n: 20 },
});
eq('thiếu loại câu', parseQuizParams({ scope: 'lesson:2', types: '', n: '20' }), { ok: false, error: 'Chọn ít nhất một loại câu hỏi' });
eq('loại câu lạ', parseQuizParams({ scope: 'lesson:2', types: 'K9', n: '5' }).ok, false);
eq('n quá lớn', parseQuizParams({ scope: 'lesson:2', types: 'K1', n: '500' }), { ok: false, error: 'Tối đa 200 câu' });
eq('n = 0', parseQuizParams({ scope: 'lesson:2', types: 'K1', n: '0' }), { ok: false, error: 'Số câu tối thiểu là 1' });
eq('scope sai', parseQuizParams({ scope: 'lesson:x', types: 'K1', n: '5' }), { ok: false, error: 'Phạm vi luyện không hợp lệ' });
eq('mảng tham số lấy phần tử đầu', parseQuizParams({ scope: ['lesson:1', 'lesson:2'], types: 'K2', n: '1' }).ok, true);

// ---------- buildCandidates ----------
const catalog: CatalogRow[] = [
  { item_type: 'kanji', item_id: 'k1', question_type: 'K2' },
  { item_type: 'kanji', item_id: 'k1', question_type: 'K1' },
  { item_type: 'example', item_id: 'e1', question_type: 'E2' },
  { item_type: 'example', item_id: 'e1', question_type: 'E2' }, // trùng do ví dụ thuộc 2 bài
  { item_type: 'example', item_id: 'e1', question_type: 'E1' },
  { item_type: 'example', item_id: 'e2', question_type: 'E2' },
];
const states: CardStateRow[] = [
  { item_type: 'kanji', item_id: 'k1', question_type: 'K1', correct_count: 3, wrong_count: 0, streak: 3, mastery_level: 'mastered', last_reviewed_at: null },
  { item_type: 'kanji', item_id: 'zz', question_type: 'K1', correct_count: 1, wrong_count: 0, streak: 1, mastery_level: 'to_confirm', last_reviewed_at: null },
];
const cands = buildCandidates(catalog, states);
eq('gộp theo mục, giữ thứ tự gặp đầu', cands.map((c) => c.itemId), ['k1', 'e1', 'e2']);
eq('loại câu sắp K1,E1,K2,E2 và không trùng', cands.map((c) => c.applicableQuestionTypes), [['K1', 'K2'], ['E1', 'E2'], ['E2']]);
eq('gắn trạng thái đúng thẻ', cands[0].cardStates.K1?.masteryLevel, 'mastered');
eq('trạng thái của mục ngoài phạm vi bị bỏ', cands.some((c) => c.itemId === 'zz'), false);
eq('countByType', countByType(cands), { K1: 1, E1: 1, K2: 1, E2: 2 });
eq('restrictToTypes bỏ mục không còn loại nào', restrictToTypes(cands, ['E1']).map((c) => c.itemId), ['e1']);

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
