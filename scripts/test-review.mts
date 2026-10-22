// Kiểm thử tích hợp module Ôn luyện (cần Supabase local đang chạy + đã seed seed-review.sql). KHÔNG db reset.
// 1) Chấm điểm TS (packages/core) ≡ SQL (review_hv_key / review_hv_compare / review_grade_answer) trên cùng bảng ca.
// 2) Luồng thật qua Auth + RPC + RLS: thống kê, phạm vi luyện, đề không lộ đáp án, nộp bài, idempotent, danh sách.
import { randomUUID } from 'node:crypto';
import { compareHanVietAnswer, compareJapaneseAnswer, hanVietSyllableKey } from '@roadmap/core';
import { createTestUser, deleteTestUser, makeChecker } from './integration-helpers.mts';
import { loadHomeStats, loadKanjiDetail, loadLessonKanji, loadListDetail, loadLists, loadQuizBatch, loadScopeCandidates } from '../apps/web/src/lib/review-data.ts';
import {
  addReviewListItems,
  createReviewList,
  deleteReviewList,
  removeReviewListItem,
  revealKanjiAnswer,
  submitReviewAnswer,
} from '../apps/web/src/lib/review-mutations.ts';
import { maxQuestionsFor } from '@roadmap/core';

const { eq, report } = makeChecker();
const userA = await createTestUser('review-a');
const userB = await createTestUser('review-b');

try {
  const a = userA.client;

  // ---------- 1) Tương đương TS ↔ SQL ----------
  const syllables = ['hoà', 'hòa', 'uý', 'úy', 'Hỏa', 'Hóa', ' nhất ', 'Nhất', 'hanh', 'hành', 'hoa', 'trươc', 'trước', 'ĐẠI', 'Đại', 'dại', 'Nhất', 'hoàá', '', 'Nhân', 'nhân', 'Lý', 'Lí'];
  for (const s of syllables) {
    const { data, error } = await a.rpc('review_hv_key', { p_input: s });
    eq(`SQL review_hv_key("${s}") ≡ TS`, error ? `ERR ${error.message}` : data, hanVietSyllableKey(s));
  }
  const compareCases: [string, string[][]][] = [
    ['nhất thời', [['Nhất'], ['Thời', 'Thì']]],
    ['Nhất Thì', [['Nhất'], ['Thời', 'Thì']]],
    ['  nhất   thời ', [['Nhất'], ['Thời', 'Thì']]],
    ['nhất', [['Nhất'], ['Thời']]],
    ['thời nhất', [['Nhất'], ['Thời']]],
    ['hoa', [['hoà']]],
    ['', [['Nhất']]],
    ['bổn', [['Bản', 'Bổn']]],
  ];
  for (const [input, parts] of compareCases) {
    const { data, error } = await a.rpc('review_hv_compare', { p_input: input, p_parts: parts });
    eq(`SQL review_hv_compare("${input}") ≡ TS`, error ? `ERR ${error.message}` : data, compareHanVietAnswer(input, parts));
  }
  for (const [input, forms] of [
    ['ひとつ', ['ひとつ', '一つ']],
    [' ひと　つ ', ['ひとつ']],
    ['ﾓﾉ', ['モノ']],
    ['もの', ['モノ']],
  ] as [string, string[]][]) {
    const { data } = await a.rpc('review_jp_normalize', { p_input: input });
    const sqlMatch = forms.some((f) => f.normalize('NFKC').replace(/\s+/g, '') === data) && data !== '';
    eq(`SQL review_jp_normalize("${input}") khớp TS`, sqlMatch, compareJapaneseAnswer(input, forms));
  }

  // ---------- 2) Dữ liệu seed nhìn thấy qua RLS ----------
  const home = await loadHomeStats(a);
  eq('Home: đúng 12 bài đã nạp', home.lessons.map((l) => l.lesson), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  eq('Home: user mới chưa làm thẻ nào', home.overall.seen, 0);
  eq('Home: 8 kanji + 21 ví dụ chờ xác nhận', [home.overall.pending_kanji, home.overall.pending_examples], [8, 21]);
  eq('Home: tổng thẻ > 0', home.overall.total > 0, true);

  const lesson1 = await loadLessonKanji(a, 1);
  eq('Bài 1 có 16 kanji', lesson1.length, 16);
  eq('Bài 1 kanji đầu là 一', lesson1[0]?.kanji, '一');
  const detail = await loadKanjiDetail(a, '04e00');
  eq('Chi tiết 一: Hán Việt Nhất', detail?.han_viet_main, 'Nhất');
  eq('Chi tiết 一: có ví dụ', (detail?.examples.length ?? 0) > 0, true);
  eq('Chi tiết 一: svg_path', detail?.svg_path, '/kanjivg/04e00.svg');

  // ---------- 3) Phạm vi bài 1 → đề không lộ đáp án ----------
  const cands = await loadScopeCandidates(a, { kind: 'lesson', lesson: 1 });
  const kanjiCands = cands.filter((c) => c.itemType === 'kanji');
  eq('Bài 1: 16 kanji đều có K1+K2', kanjiCands.every((c) => c.applicableQuestionTypes.join() === 'K1,K2'), true);
  eq('Bài 1: candidates kanji đứng trước ví dụ', cands[0]?.itemType, 'kanji');
  eq('Bài 1: maxQuestions = Σ loại áp dụng', maxQuestionsFor(cands) >= 32, true);

  // Việc 1 (phản hồi test thật): ví dụ chỉ còn trắc nghiệm E1, E2 không còn được sinh ra nữa — số câu
  // phụ thuộc dữ liệu seed thật (catalog E1 nới điều kiện so với trước), nên chỉ kiểm tra có câu và ≤ 40.
  const batch = await loadQuizBatch(a, { kind: 'lesson', lesson: 1 }, ['K1', 'K2', 'E1', 'E2'], 40);
  eq('Đề bài 1 có câu, tối đa 40', batch.length > 0 && batch.length <= 40, true);
  eq('Đề K1 không có han_viet_main', batch.filter((q) => q.question_type === 'K1').every((q) => !('han_viet_main' in q.prompt)), true);
  eq('Đề K2 không có kanji', batch.filter((q) => q.question_type === 'K2').every((q) => !('kanji' in q.prompt)), true);
  eq('Đề không còn câu E2 (đã dừng sinh)', batch.some((q) => q.question_type === 'E2'), false);
  eq(
    'Đề E1 ví dụ có meaning_vi + choices (không có term)',
    batch.filter((q) => q.question_type === 'E1').every((q) => typeof q.prompt.meaning_vi === 'string' && Array.isArray(q.prompt.choices) && q.prompt.choices.length >= 1 && !('term' in q.prompt)),
    true
  );

  // ---------- 4) Nộp bài thật trên dữ liệu seed ----------
  const ichi = lesson1[0]!;
  const r1 = await submitReviewAnswer(a, { itemType: 'kanji', itemId: ichi.id, questionType: 'K1', answerText: 'nhất', selfCorrect: null, clientAttemptId: randomUUID() });
  eq('K1 一 "nhất" đúng', [r1.is_correct, r1.new_mastery_level, r1.answer.han_viet_main], [true, 'to_confirm', 'Nhất']);
  const r2 = await submitReviewAnswer(a, { itemType: 'kanji', itemId: ichi.id, questionType: 'K1', answerText: 'nhat', selfCorrect: null, clientAttemptId: randomUUID() });
  eq('K1 一 "nhat" (không dấu) sai → bad', [r2.is_correct, r2.new_mastery_level], [false, 'bad']);

  // 本: chấp nhận Bổn (han_viet_accepted)
  const hon = (await loadKanjiDetail(a, '0672c'))!;
  const r3 = await submitReviewAnswer(a, { itemType: 'kanji', itemId: hon.id, questionType: 'K1', answerText: 'Bổn', selfCorrect: null, clientAttemptId: randomUUID() });
  eq('K1 本 "Bổn" (cách viết chấp nhận) đúng', r3.is_correct, true);

  // E1 trên ví dụ 一つ — Việc 1: giờ là trắc nghiệm, chấm bằng so khớp CHÍNH XÁC với term (không phải Hán Việt).
  const hitotsu = detail!.examples.find((e) => e.term === '一つ')!;
  const r4 = await submitReviewAnswer(a, { itemType: 'example', itemId: hitotsu.id, questionType: 'E1', answerText: hitotsu.term, selfCorrect: null, clientAttemptId: randomUUID() });
  eq('E1 一つ bấm đúng từ (term) → đúng', [r4.is_correct, r4.answer.term], [true, '一つ']);
  const r4b = await submitReviewAnswer(a, { itemType: 'example', itemId: hitotsu.id, questionType: 'E1', answerText: 'không phải 一つ', selfCorrect: null, clientAttemptId: randomUUID() });
  eq('E1 bấm nhiễu (không khớp term) → sai', r4b.is_correct, false);
  // E2 không còn được sinh ra (review_card_catalog dừng tạo thẻ E2 cho ví dụ) → nộp E2 bị từ chối.
  let e2Blocked = false;
  try {
    await submitReviewAnswer(a, { itemType: 'example', itemId: hitotsu.id, questionType: 'E2', answerText: 'ひとつ', selfCorrect: null, clientAttemptId: randomUUID() });
  } catch {
    e2Blocked = true;
  }
  eq('Nộp E2 cho ví dụ bị từ chối (không còn trong catalog)', e2Blocked, true);

  // K2: reveal không ghi gì, self-assess + idempotent
  const reveal = await revealKanjiAnswer(a, ichi.id);
  eq('K2 reveal trả kanji + svg', [reveal.kanji, reveal.svg_path], ['一', '/kanjivg/04e00.svg']);
  const attempt = randomUUID();
  const r6 = await submitReviewAnswer(a, { itemType: 'kanji', itemId: ichi.id, questionType: 'K2', answerText: null, selfCorrect: true, clientAttemptId: attempt });
  const r6b = await submitReviewAnswer(a, { itemType: 'kanji', itemId: ichi.id, questionType: 'K2', answerText: null, selfCorrect: true, clientAttemptId: attempt });
  eq('K2 gửi lại cùng mã không tính 2 lần', [r6.new_streak, r6b.new_streak, r6b.duplicate], [1, 1, true]);
  const { count: logCount } = await a.from('review_attempt_log').select('id', { count: 'exact', head: true });
  // r1,r2 (K1 一), r3 (K1 本), r4,r4b (E1 一つ), r6 (K2 一) = 6 (E2 bị chặn không ghi, r6b gửi lại không ghi).
  eq('attempt_log có đúng 6 lần (E2 bị chặn, gửi lại không ghi)', logCount, 6);

  // kanji chờ xác nhận không nộp được
  const { data: pending } = await a.from('review_kanji').select('id').is('confirmed_at', null).limit(1).single();
  let rejected = false;
  try {
    await submitReviewAnswer(a, { itemType: 'kanji', itemId: pending!.id, questionType: 'K1', answerText: 'x', selfCorrect: null, clientAttemptId: randomUUID() });
  } catch {
    rejected = true;
  }
  eq('Kanji chờ xác nhận bị từ chối khi nộp', rejected, true);

  const homeAfter = await loadHomeStats(a);
  eq('Home sau khi làm: đã làm 4 thẻ (K1/K2 一, K1 本, E1 一つ)', homeAfter.overall.seen, 4);

  // ---------- 5) Danh sách ----------
  const listId = await createReviewList(a, userA.id, 'Chữ khó');
  let dup = false;
  try {
    await createReviewList(a, userA.id, 'Chữ khó');
  } catch {
    dup = true;
  }
  eq('Tên danh sách trùng bị từ chối', dup, true);
  eq('Thêm 2 mục', await addReviewListItems(a, listId, [{ itemType: 'kanji', itemId: ichi.id }, { itemType: 'example', itemId: hitotsu.id }]), 2);
  eq('Thêm lại mục cũ: bỏ qua, không lỗi', await addReviewListItems(a, listId, [{ itemType: 'kanji', itemId: ichi.id }]), 0);
  const lists = await loadLists(a);
  eq('loadLists đếm đúng số mục', lists.map((l) => [l.name, l.item_count]), [['Chữ khó', 2]]);
  const listDetail = await loadListDetail(a, listId);
  eq('Chi tiết danh sách', listDetail?.items.map((i) => [i.label, i.hex]), [['一', '04e00'], ['一つ', null]]);
  // Danh sách chỉ thêm tường minh kanji 一 + ví dụ 一つ, nhưng đề vẫn phải kéo theo TOÀN BỘ ví dụ gắn với
  // kanji 一 (không chỉ 一つ) — phản hồi người dùng: chọn riêng lẻ/theo danh sách vẫn phải có câu hỏi ví dụ
  // của đúng những kanji đã chọn, không chỉ khi luyện cả bài qua scope lesson:.
  const listCandidates = await loadScopeCandidates(a, { kind: 'list', listIds: [listId] });
  const listK1Count = listCandidates.filter((c) => c.applicableQuestionTypes.includes('K1')).length;
  const listE1Count = listCandidates.filter((c) => c.applicableQuestionTypes.includes('E1')).length;
  eq('Danh sách kéo theo toàn bộ ví dụ của kanji đã chọn, không chỉ ví dụ đã thêm tường minh', listE1Count > 1, true);
  const listBatch = await loadQuizBatch(a, { kind: 'list', listIds: [listId] }, ['K1', 'E1'], 10);
  const listBatchTypes = listBatch.map((q) => q.question_type).sort();
  if (listK1Count + listE1Count <= 10) {
    // Tổng candidate không vượt n=10 → RPC random không cắt bớt gì, đề phải chứa ĐÚNG toàn bộ candidate.
    eq(
      'Đề từ danh sách: đủ K1 (kanji 一) + E1 (mọi ví dụ của 一, kể cả không thêm tường minh)',
      listBatchTypes,
      [...Array(listE1Count).fill('E1'), ...Array(listK1Count).fill('K1')].sort()
    );
  } else {
    // Tổng candidate > n → RPC random bớt, không đoán trước được thành phần — chỉ kiểm tra đủ số câu.
    eq('Đề từ danh sách: đủ 10 câu khi pool > 10', listBatchTypes.length, 10);
  }

  // B không thấy / không thêm được vào danh sách của A
  const b = userB.client;
  eq('B không thấy danh sách của A', (await loadLists(b)).length, 0);
  eq('B đọc chi tiết danh sách của A → null', await loadListDetail(b, listId), null);
  let bBlocked = false;
  try {
    await addReviewListItems(b, listId, [{ itemType: 'kanji', itemId: hon.id }]);
  } catch {
    bBlocked = true;
  }
  eq('B không thêm được vào danh sách của A', bBlocked, true);
  let bDelete = false;
  try {
    await deleteReviewList(b, listId);
  } catch {
    bDelete = true;
  }
  eq('B không xoá được danh sách của A', bDelete, true);
  eq('Thống kê của B không lẫn của A', (await loadHomeStats(b)).overall.seen, 0);

  // Chiến lược thông minh: unseen_first ưu tiên thẻ chưa làm
  const smart = await loadQuizBatch(a, { kind: 'smart', strategy: 'least_streak' }, ['K1'], 5);
  eq('Smart least_streak: 5 câu K1', smart.length, 5);

  await removeReviewListItem(a, listId, 'example', hitotsu.id);
  eq('Xoá mục khỏi danh sách', (await loadListDetail(a, listId))?.items.length, 1);
  await deleteReviewList(a, listId);
  eq('Xoá danh sách', (await loadLists(a)).length, 0);
} finally {
  await deleteTestUser(userA);
  await deleteTestUser(userB);
}

report();
