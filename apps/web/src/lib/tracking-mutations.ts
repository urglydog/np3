import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors';

/** Giống schedule-mutations.ts: chỉ nhận SupabaseClient có sẵn, dùng chung Server Action + script tích hợp. */

export interface TrackingResult {
  taskId: string;
  writingReps: number;
  kanaAccuracy: number;
  speakingMinutes: number;
}

export async function recordTracking(
  supabase: SupabaseClient,
  taskId: string,
  writingReps: number,
  kanaAccuracy: number,
  speakingMinutes: number
): Promise<TrackingResult> {
  const { data: plan } = await supabase.from('plans').select('id').limit(1).maybeSingle();
  if (!plan) throw new AppError('Bạn chưa có lộ trình', 'no_plan', 404);

  const { data: existing } = await supabase.from('plan_task_state').select('task_id').eq('plan_id', plan.id).eq('task_id', taskId).maybeSingle();
  if (!existing) throw new AppError('Không tìm thấy task trong lộ trình của bạn', 'task_not_found', 404);

  const { error } = await supabase
    .from('plan_task_state')
    .update({ writing_reps: writingReps, kana_accuracy: kanaAccuracy, speaking_minutes: speakingMinutes })
    .eq('plan_id', plan.id)
    .eq('task_id', taskId);
  if (error) throw new AppError(error.message, 'update_failed', 400);

  return { taskId, writingReps, kanaAccuracy, speakingMinutes };
}
