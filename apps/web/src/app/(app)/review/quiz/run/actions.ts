'use server';

// Server Action bọc 3 RPC của module Ôn luyện (review_get_quiz_batch/review_reveal_answer/
// review_submit_answer) — client (quiz-runner.tsx) KHÔNG BAO GIỜ gọi RPC trực tiếp.
// Luôn lấy user từ session (getCurrentUser), không tin bất kỳ user_id nào từ client — RLS tự chặn
// nếu lọt nhưng đây là lớp phòng vệ ở tầng ứng dụng.
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { AppError, toUserMessage } from '@/lib/errors';

export type ReviewItemType = 'kanji' | 'example';
export type ReviewQuestionType = 'K1' | 'E1' | 'K2' | 'E2';

export interface QuizItemRef {
  itemType: ReviewItemType;
  itemId: string;
}

export interface QuizBatchItem {
  itemId: string;
  itemType: ReviewItemType;
  questionType: ReviewQuestionType;
  payload: Record<string, unknown>;
}

export interface GetQuizBatchResult {
  ok: boolean;
  items?: QuizBatchItem[];
  message?: string;
}

/**
 * Bọc RPC `review_get_quiz_batch`. Với câu K2, bổ sung `stroke_points` (toạ độ nét chuẩn của CHÍNH
 * kanji đang hỏi, lấy bằng SELECT thường — không phải RPC) để client tự chấm `scoreHandwriting`
 * ngay khi vẽ xong, không cần round-trip thêm. Đây KHÔNG phải lộ đáp án Hán Việt/text — chỉ là hình
 * dạng nét của item mà client đã biết item_id (giống dữ liệu `review/browse` đã hiển thị công khai).
 */
export async function getQuizBatchAction(
  itemRefs: QuizItemRef[],
  questionTypes: ReviewQuestionType[],
  limit: number,
): Promise<GetQuizBatchResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Chưa đăng nhập' };
  if (itemRefs.length === 0 || questionTypes.length === 0 || limit <= 0) {
    return { ok: false, message: 'Phạm vi quiz không hợp lệ' };
  }
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc('review_get_quiz_batch', {
      p_item_refs: itemRefs.map((r) => ({ item_type: r.itemType, item_id: r.itemId })),
      p_question_types: questionTypes,
      p_limit: limit,
    });
    if (error) throw new AppError(error.message, 'rpc_error', 500);

    const rows = (data ?? []) as Array<{
      item_id: string;
      item_type: string;
      question_type: string;
      payload: Record<string, unknown>;
    }>;

    const k2Ids = Array.from(new Set(rows.filter((r) => r.question_type === 'K2').map((r) => r.item_id)));
    const strokePointsById = new Map<string, unknown>();
    if (k2Ids.length > 0) {
      const { data: strokeRows } = await supabase.from('review_kanji').select('id, stroke_points').in('id', k2Ids);
      for (const s of strokeRows ?? []) strokePointsById.set(s.id as string, s.stroke_points);
    }

    const items: QuizBatchItem[] = rows.map((r) => ({
      itemId: r.item_id,
      itemType: r.item_type as ReviewItemType,
      questionType: r.question_type as ReviewQuestionType,
      payload:
        r.question_type === 'K2' ? { ...r.payload, stroke_points: strokePointsById.get(r.item_id) ?? null } : r.payload,
    }));
    return { ok: true, items };
  } catch (err) {
    return { ok: false, message: toUserMessage(err) };
  }
}

export interface RevealAnswerResult {
  ok: boolean;
  kanji?: string;
  svgPath?: string;
  strokeCount?: number | null;
  hanVietMain?: string | null;
  meaningEn?: string | null;
  term?: string;
  readingKana?: string;
  meaningVi?: string | null;
  message?: string;
}

/** Bọc RPC `review_reveal_answer` — chỉ SELECT, không ghi gì; dùng cho K2 trước khi tự xác nhận ✓/✗. */
export async function revealAnswerAction(
  itemType: ReviewItemType,
  itemId: string,
  questionType: ReviewQuestionType,
): Promise<RevealAnswerResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Chưa đăng nhập' };
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc('review_reveal_answer', {
      p_item_type: itemType,
      p_item_id: itemId,
      p_question_type: questionType,
    });
    if (error) throw new AppError(error.message, 'rpc_error', 500);
    const d = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      kanji: d.kanji as string | undefined,
      svgPath: d.svg_path as string | undefined,
      strokeCount: (d.stroke_count as number | null) ?? null,
      hanVietMain: (d.han_viet_main as string | null) ?? null,
      meaningEn: (d.meaning_en as string | null) ?? null,
      term: d.term as string | undefined,
      readingKana: d.reading_kana as string | undefined,
      meaningVi: (d.meaning_vi as string | null) ?? null,
    };
  } catch (err) {
    return { ok: false, message: toUserMessage(err) };
  }
}

export interface SubmitAnswerInput {
  itemType: ReviewItemType;
  itemId: string;
  questionType: ReviewQuestionType;
  answerText: string | null;
  selfCorrect: boolean | null;
  clientAttemptId: string;
  autoGraded: boolean;
}

export interface SubmitAnswerResult {
  ok: boolean;
  isCorrect?: boolean;
  correctAnswerDisplay?: string | null;
  newStreak?: number;
  newMasteryLevel?: string;
  message?: string;
}

/**
 * Bọc RPC `review_submit_answer`. K1/E1/E2 chấm bằng so khớp chuỗi ở SERVER (client chỉ gửi
 * `answerText`, không bao giờ biết đáp án trước). K2 bỏ qua `answerText`, dùng `selfCorrect` do
 * client quyết định (tự xác nhận ✓/✗ hoặc heuristic `scoreHandwriting` tự chấm khi `autoGraded=true`).
 */
export async function submitAnswerAction(input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Chưa đăng nhập' };
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc('review_submit_answer', {
      p_item_type: input.itemType,
      p_item_id: input.itemId,
      p_question_type: input.questionType,
      p_answer_text: input.answerText,
      p_self_correct: input.selfCorrect,
      p_client_attempt_id: input.clientAttemptId,
      p_auto_graded: input.autoGraded,
    });
    if (error) throw new AppError(error.message, 'rpc_error', 500);
    const d = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      isCorrect: d.is_correct as boolean,
      correctAnswerDisplay: (d.correct_answer_display as string | null) ?? null,
      newStreak: d.new_streak as number,
      newMasteryLevel: d.new_mastery_level as string,
    };
  } catch (err) {
    return { ok: false, message: toUserMessage(err) };
  }
}
