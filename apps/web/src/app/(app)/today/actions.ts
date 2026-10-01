'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { todayInTimeZone } from '@roadmap/core';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';

const markDoneSchema = z.object({ taskId: z.string().uuid() });

export async function markTaskDone(formData: FormData): Promise<void> {
  const parsed = markDoneSchema.safeParse({ taskId: formData.get('taskId') });
  if (!parsed.success) throw new AppError('Task không hợp lệ', 'invalid_input', 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError('Chưa đăng nhập', 'unauthenticated', 401);

  const { data: plan } = await supabase.from('plans').select('id, timezone').limit(1).maybeSingle();
  if (!plan) throw new AppError('Chưa có lộ trình', 'no_plan', 404);

  const doneOn = todayInTimeZone(plan.timezone);
  const { error } = await supabase
    .from('plan_task_state')
    .update({ status: 'done', done_on: doneOn })
    .eq('plan_id', plan.id)
    .eq('task_id', parsed.data.taskId);
  if (error) throw new AppError(error.message, 'update_failed', 400);

  revalidatePath('/today');
}
