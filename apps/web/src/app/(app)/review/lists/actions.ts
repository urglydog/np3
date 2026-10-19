'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { AppError, toUserMessage } from '@/lib/errors';

// Server Action — luôn lấy user từ session (getCurrentUser), KHÔNG tin bất kỳ user_id nào từ client.
// RLS (review_list_owner/review_list_item_owner) tự chặn nếu lọt — đây là lớp phòng vệ ở tầng ứng dụng.
async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function createListAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const name = String(formData.get('name') ?? '').trim();
  try {
    if (!name) throw new AppError('Tên danh sách không được để trống', 'invalid_input', 400);
    const { error } = await supabase.from('review_list').insert({ name, user_id: user.id });
    if (error) throw new AppError(error.message, 'db_error', 500);
  } catch (err) {
    redirect(`/review/lists?error=${encodeURIComponent(toUserMessage(err))}`);
  }
  revalidatePath('/review/lists');
  redirect('/review/lists?ok=1');
}

export async function deleteListAction(formData: FormData): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const listId = String(formData.get('listId') ?? '');
  try {
    const { error } = await supabase.from('review_list').delete().eq('id', listId);
    if (error) throw new AppError(error.message, 'db_error', 500);
  } catch (err) {
    redirect(`/review/lists?error=${encodeURIComponent(toUserMessage(err))}`);
  }
  revalidatePath('/review/lists');
  revalidatePath('/review/browse');
  redirect('/review/lists?ok=1');
}

export async function removeListItemAction(formData: FormData): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const listId = String(formData.get('listId') ?? '');
  const itemType = String(formData.get('itemType') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  try {
    const { error } = await supabase
      .from('review_list_item')
      .delete()
      .eq('list_id', listId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);
    if (error) throw new AppError(error.message, 'db_error', 500);
  } catch (err) {
    redirect(`/review/lists?error=${encodeURIComponent(toUserMessage(err))}`);
  }
  revalidatePath('/review/lists');
  redirect('/review/lists?ok=1');
}

export interface AddItemsResult {
  ok: boolean;
  message?: string;
}

/**
 * Thêm nhiều item vào 1 list có sẵn hoặc list mới — gọi trực tiếp (không qua <form action>) từ
 * components/review-select-toolbar.tsx ('use client') để nhận lại kết quả hiện ngay trong bottom sheet.
 */
export async function addItemsToListAction(formData: FormData): Promise<AddItemsResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const existingListId = String(formData.get('listId') ?? '').trim();
  const newListName = String(formData.get('newListName') ?? '').trim();
  const itemType = String(formData.get('itemType') ?? 'kanji');

  let itemIds: string[] = [];
  try {
    itemIds = JSON.parse(String(formData.get('itemIds') ?? '[]'));
  } catch {
    return { ok: false, message: 'Dữ liệu lựa chọn không hợp lệ' };
  }
  if (itemIds.length === 0) return { ok: false, message: 'Chưa chọn mục nào' };

  try {
    let listId = existingListId;
    if (!listId) {
      if (!newListName) throw new AppError('Chọn danh sách có sẵn hoặc đặt tên danh sách mới', 'invalid_input', 400);
      const { data, error } = await supabase.from('review_list').insert({ name: newListName, user_id: user.id }).select('id').single();
      if (error) throw new AppError(error.message, 'db_error', 500);
      listId = data.id as string;
    }
    const rows = itemIds.map((itemId) => ({ list_id: listId, item_type: itemType, item_id: itemId }));
    const { error } = await supabase.from('review_list_item').upsert(rows, { onConflict: 'list_id,item_type,item_id' });
    if (error) throw new AppError(error.message, 'db_error', 500);
  } catch (err) {
    return { ok: false, message: toUserMessage(err) };
  }
  revalidatePath('/review/lists');
  revalidatePath('/review/browse');
  return { ok: true };
}
