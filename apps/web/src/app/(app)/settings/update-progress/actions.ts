'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AppError, toUserMessage } from '@/lib/errors';

const schema = z.object({ code: z.string().min(1) });

export async function applyProgressUpdate(formData: FormData): Promise<void> {
  let count = 0;
  try {
    const parsed = schema.safeParse({ code: formData.get('code') });
    if (!parsed.success) throw new AppError('Mã task không hợp lệ', 'invalid_input', 400);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError('Chưa đăng nhập', 'unauthenticated', 401);

    const { data, error } = await supabase.rpc('update_plan_progress', { p_done_up_to_code: parsed.data.code });
    if (error) throw new AppError(error.message, 'update_progress_failed', 400);
    count = data ?? 0;
  } catch (err) {
    // Không có UI hiển thị lỗi riêng ở bước này; để Next hiện error boundary mặc định.
    throw new Error(toUserMessage(err));
  }
  revalidatePath('/today');
  redirect(`/settings/update-progress?updated=${count}`);
}
