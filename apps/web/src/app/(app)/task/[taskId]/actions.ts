'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseUpdateStatsForm } from '@/lib/schedule-forms';
import { updateTaskStatsInDb } from '@/lib/schedule-mutations';
import { AppError, toUserMessage } from '@/lib/errors';

async function getUserOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

export async function updateTaskStatsAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let taskId = '';
  let url: string;
  try {
    const rawTaskId = formData.get('taskId');
    taskId = typeof rawTaskId === 'string' ? rawTaskId : '';
    const parsed = parseUpdateStatsForm(formData);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    await updateTaskStatsInDb(supabase, parsed.value.taskId, {
      writingReps: parsed.value.writingReps,
      speakingMinutes: parsed.value.speakingMinutes,
      kanaAccuracy: parsed.value.kanaAccuracy,
    });
    url = `/task/${taskId}?ok=1`;
  } catch (err) {
    url = `/task/${taskId}?error=${encodeURIComponent(toUserMessage(err))}`;
  }
  revalidatePath(`/task/${taskId}`);
  redirect(url);
}
