import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemType, MasteryLevel, QuestionType } from '@roadmap/core';
import { AppError } from './errors';

/**
 * Ghi dữ liệu module Ôn luyện. Giống resource-mutations.ts: chỉ nhận SupabaseClient có sẵn để Server Action
 * và script tích hợp gọi chung. Không bao giờ nhận user_id từ client — RPC/RLS tự lấy auth.uid().
 */

export interface SubmitAnswerInput {
  itemType: ItemType;
  itemId: string;
  questionType: QuestionType;
  answerText: string | null;
  selfCorrect: boolean | null;
  clientAttemptId: string;
}

export interface SubmitAnswerResult {
  is_correct: boolean;
  duplicate: boolean;
  new_streak: number;
  new_mastery_level: MasteryLevel;
  answer: {
    kanji?: string;
    han_viet_main?: string;
    han_viet_accepted?: string[];
    meaning_vi?: string | null;
    meaning_en?: string | null;
    unicode_hex?: string;
    term?: string;
    reading_kana?: string;
    han_viet?: string | null;
  };
}

export async function submitReviewAnswer(supabase: SupabaseClient, input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
  const { data, error } = await supabase.rpc('review_submit_answer', {
    p_item_type: input.itemType,
    p_item_id: input.itemId,
    p_question_type: input.questionType,
    p_answer_text: input.answerText,
    p_self_correct: input.selfCorrect,
    p_client_attempt_id: input.clientAttemptId,
  });
  if (error) throw new AppError(error.message, 'review_submit_failed', 400);
  return data as SubmitAnswerResult;
}

export interface RevealResult {
  kanji: string;
  svg_path: string;
  stroke_count: number | null;
  han_viet_main: string | null;
  meaning_en: string | null;
}

export async function revealKanjiAnswer(supabase: SupabaseClient, itemId: string): Promise<RevealResult> {
  const { data, error } = await supabase.rpc('review_reveal_answer', { p_item_type: 'kanji', p_item_id: itemId, p_question_type: 'K2' });
  if (error) throw new AppError(error.message, 'review_reveal_failed', 400);
  return data as RevealResult;
}

export async function createReviewList(supabase: SupabaseClient, userId: string, name: string): Promise<string> {
  const { data, error } = await supabase.from('review_list').insert({ user_id: userId, name }).select('id').single();
  if (error) {
    if (error.code === '23505') throw new AppError('Bạn đã có danh sách cùng tên', 'review_list_duplicate', 409);
    throw new AppError(`Không tạo được danh sách: ${error.message}`, 'review_list_create_failed');
  }
  return data.id;
}

export async function renameReviewList(supabase: SupabaseClient, listId: string, name: string): Promise<void> {
  const { data, error } = await supabase.from('review_list').update({ name }).eq('id', listId).select('id');
  if (error) {
    if (error.code === '23505') throw new AppError('Bạn đã có danh sách cùng tên', 'review_list_duplicate', 409);
    throw new AppError(`Không đổi tên được: ${error.message}`, 'review_list_update_failed');
  }
  if (!data?.length) throw new AppError('Không tìm thấy danh sách', 'review_list_not_found', 404);
}

export async function deleteReviewList(supabase: SupabaseClient, listId: string): Promise<void> {
  const { data, error } = await supabase.from('review_list').delete().eq('id', listId).select('id');
  if (error) throw new AppError(`Không xoá được danh sách: ${error.message}`, 'review_list_delete_failed');
  if (!data?.length) throw new AppError('Không tìm thấy danh sách', 'review_list_not_found', 404);
}

/** Thêm nhiều mục; mục đã có trong danh sách thì bỏ qua (không lỗi). Trả về số mục thêm mới. */
export async function addReviewListItems(
  supabase: SupabaseClient,
  listId: string,
  items: { itemType: ItemType; itemId: string }[]
): Promise<number> {
  if (items.length === 0) return 0;
  const { data, error } = await supabase
    .from('review_list_item')
    .upsert(
      items.map((i) => ({ list_id: listId, item_type: i.itemType, item_id: i.itemId })),
      { onConflict: 'list_id,item_type,item_id', ignoreDuplicates: true }
    )
    .select('item_id');
  if (error) {
    if (error.code === '42501') throw new AppError('Không tìm thấy danh sách', 'review_list_not_found', 404);
    throw new AppError(`Không thêm được vào danh sách: ${error.message}`, 'review_list_add_failed');
  }
  return data?.length ?? 0;
}

export async function removeReviewListItem(supabase: SupabaseClient, listId: string, itemType: ItemType, itemId: string): Promise<void> {
  const { error } = await supabase.from('review_list_item').delete().eq('list_id', listId).eq('item_type', itemType).eq('item_id', itemId);
  if (error) throw new AppError(`Không xoá được mục: ${error.message}`, 'review_list_remove_failed');
}

/** Đổi danh sách mã hex kanji thành id (bỏ qua mã không tồn tại). */
export async function kanjiIdsByHex(supabase: SupabaseClient, hexes: string[]): Promise<string[]> {
  if (hexes.length === 0) return [];
  const { data, error } = await supabase.from('review_kanji').select('id').in('unicode_hex', hexes);
  if (error) throw new AppError(`Không đọc được kanji: ${error.message}`, 'review_read_failed');
  return (data ?? []).map((r) => r.id);
}
