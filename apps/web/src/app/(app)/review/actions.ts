'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AppError, toUserMessage } from '@/lib/errors';
import { copy } from '@/lib/copy';
import {
  addReviewListItems,
  createReviewList,
  deleteReviewList,
  kanjiIdsByHex,
  removeReviewListItem,
  revealKanjiAnswer,
  submitReviewAnswer,
  type RevealResult,
  type SubmitAnswerResult,
} from '@/lib/review-mutations';

async function getSupabaseAndUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

/** Chỉ cho quay về đường dẫn nội bộ /review/... (chống open redirect). */
function safeReturnTo(raw: FormDataEntryValue | null, fallback: string): string {
  return typeof raw === 'string' && raw.startsWith('/review') && !raw.startsWith('//') ? raw : fallback;
}

function withParam(url: string, key: string, value: string): string {
  const [path, hash] = url.split('#');
  const u = new URL(path!, 'http://x');
  u.searchParams.delete('ok');
  u.searchParams.delete('error');
  u.searchParams.set(key, value);
  return `${u.pathname}${u.search}${hash ? `#${hash}` : ''}`;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------- Quiz (gọi từ QuizRunner, trả kết quả thay vì redirect) ----------
const uuid = z.string().uuid();
const submitSchema = z.object({
  itemType: z.enum(['kanji', 'example']),
  itemId: uuid,
  questionType: z.enum(['K1', 'E1', 'K2', 'E2']),
  answerText: z.string().max(200).nullable(),
  selfCorrect: z.boolean().nullable(),
  clientAttemptId: uuid,
});

export async function submitAnswerAction(input: z.input<typeof submitSchema>): Promise<ActionResult<SubmitAnswerResult>> {
  try {
    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) throw new AppError('Dữ liệu câu trả lời không hợp lệ', 'invalid_input', 400);
    const { supabase } = await getSupabaseAndUser();
    const data = await submitReviewAnswer(supabase, parsed.data);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}

export async function revealAnswerAction(itemId: string): Promise<ActionResult<RevealResult>> {
  try {
    if (!uuid.safeParse(itemId).success) throw new AppError('Mã kanji không hợp lệ', 'invalid_input', 400);
    const { supabase } = await getSupabaseAndUser();
    return { ok: true, data: await revealKanjiAnswer(supabase, itemId) };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}

// ---------- Danh sách (form, redirect kèm ?ok / ?error như các màn khác) ----------
const listName = z.string().trim().min(1, 'Tên danh sách không được để trống').max(100, 'Tên danh sách tối đa 100 ký tự');

export async function createListAction(formData: FormData): Promise<void> {
  const { supabase, user } = await getSupabaseAndUser();
  let url: string;
  try {
    const name = listName.safeParse(formData.get('name'));
    if (!name.success) throw new AppError(name.error.issues[0]!.message, 'invalid_input', 400);
    const id = await createReviewList(supabase, user.id, name.data);
    url = `/review/lists/${id}?ok=1`;
  } catch (err) {
    url = withParam('/review/lists', 'error', toUserMessage(err));
  }
  revalidatePath('/review/lists');
  redirect(url);
}

export async function deleteListAction(formData: FormData): Promise<void> {
  const { supabase } = await getSupabaseAndUser();
  let url = '/review/lists?ok=1';
  try {
    const id = uuid.safeParse(formData.get('listId'));
    if (!id.success) throw new AppError('Mã danh sách không hợp lệ', 'invalid_input', 400);
    await deleteReviewList(supabase, id.data);
  } catch (err) {
    url = withParam('/review/lists', 'error', toUserMessage(err));
  }
  revalidatePath('/review/lists');
  redirect(url);
}

export async function removeListItemAction(formData: FormData): Promise<void> {
  const { supabase } = await getSupabaseAndUser();
  const listId = String(formData.get('listId') ?? '');
  let url = `/review/lists/${encodeURIComponent(listId)}?ok=1`;
  try {
    const parsed = z
      .object({ listId: uuid, itemType: z.enum(['kanji', 'example']), itemId: uuid })
      .safeParse({ listId, itemType: formData.get('itemType'), itemId: formData.get('itemId') });
    if (!parsed.success) throw new AppError('Dữ liệu không hợp lệ', 'invalid_input', 400);
    await removeReviewListItem(supabase, parsed.data.listId, parsed.data.itemType, parsed.data.itemId);
  } catch (err) {
    url = withParam(`/review/lists/${encodeURIComponent(listId)}`, 'error', toUserMessage(err));
  }
  revalidatePath(`/review/lists/${listId}`);
  redirect(url);
}

/**
 * Thêm nhiều mục vào danh sách có sẵn (listId) hoặc danh sách mới (newListName).
 * Mục gửi lên dạng "kanji:<hex>" hoặc "example:<uuid>" (trường `item`, lặp nhiều lần).
 */
export async function addToListAction(formData: FormData): Promise<void> {
  const { supabase, user } = await getSupabaseAndUser();
  const returnTo = safeReturnTo(formData.get('returnTo'), '/review/browse');
  let url: string;
  try {
    const raw = formData.getAll('item').map(String);
    const hexes = raw.filter((r) => r.startsWith('kanji:')).map((r) => r.slice(6).toLowerCase()).filter((h) => /^[0-9a-f]{4,6}$/.test(h));
    const exampleIds = raw.filter((r) => r.startsWith('example:')).map((r) => r.slice(8)).filter((id) => uuid.safeParse(id).success);
    if (hexes.length + exampleIds.length === 0) throw new AppError('Chưa chọn mục nào', 'invalid_input', 400);
    if (hexes.length + exampleIds.length > 500) throw new AppError('Mỗi lần thêm tối đa 500 mục', 'invalid_input', 400);

    const target = String(formData.get('listId') ?? '');
    let listId: string;
    if (target === '__new') {
      const name = listName.safeParse(formData.get('newListName'));
      if (!name.success) throw new AppError(name.error.issues[0]!.message, 'invalid_input', 400);
      listId = await createReviewList(supabase, user.id, name.data);
    } else {
      const id = uuid.safeParse(target);
      if (!id.success) throw new AppError('Chọn danh sách để thêm vào', 'invalid_input', 400);
      listId = id.data;
    }
    const kanjiIds = await kanjiIdsByHex(supabase, hexes);
    const added = await addReviewListItems(supabase, listId, [
      ...kanjiIds.map((id) => ({ itemType: 'kanji' as const, itemId: id })),
      ...exampleIds.map((id) => ({ itemType: 'example' as const, itemId: id })),
    ]);
    url = withParam(returnTo, 'ok', copy.reviewAddToListAdded(added));
  } catch (err) {
    url = withParam(returnTo, 'error', toUserMessage(err));
  }
  revalidatePath('/review/lists');
  redirect(url);
}
