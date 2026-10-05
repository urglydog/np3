// Logic xuất/nhập sao lưu — dùng chung cho Server Action và script tích hợp.
// Nhận SupabaseClient từ ngoài, không tự tạo (giống resource-mutations.ts / schedule-mutations.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import { backupDataSchema, type BackupData } from '@roadmap/core';
import { AppError } from './errors';

// ── Export ───────────────────────────────────────────────────────────────────

/**
 * Đọc toàn bộ dữ liệu plan của user hiện tại và trả về đối tượng BackupData.
 * Lỗi ném AppError để caller có thể hiển thị cho người dùng.
 */
export async function exportPlan(supabase: SupabaseClient): Promise<BackupData> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError('Chưa đăng nhập.', 'UNAUTHENTICATED', 401);

  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, include_optional, timezone, created_at')
    .limit(1)
    .maybeSingle();

  if (planErr) throw new AppError('Không thể đọc plan: ' + planErr.message, 'DB_ERROR');
  if (!plan) throw new AppError('Chưa có lộ trình để xuất.', 'NO_PLAN', 404);

  const { data: taskStates, error: tsErr } = await supabase
    .from('plan_task_state')
    .select('task_id, status, writing_reps, kana_accuracy, speaking_minutes, pinned_start, done_on')
    .eq('plan_id', plan.id);

  if (tsErr) throw new AppError('Không thể đọc trạng thái task: ' + tsErr.message, 'DB_ERROR');

  const { data: resourceStates, error: rsErr } = await supabase
    .from('plan_resource_state')
    .select('resource_id, status, opted_in, ordered_on, eta')
    .eq('plan_id', plan.id);

  if (rsErr) throw new AppError('Không thể đọc trạng thái tài nguyên: ' + rsErr.message, 'DB_ERROR');

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    plan: {
      id: plan.id,
      template_id: plan.template_id,
      start_date: plan.start_date,
      hours_per_day: Number(plan.hours_per_day),
      days_per_week: plan.days_per_week,
      include_optional: plan.include_optional,
      timezone: plan.timezone,
      created_at: plan.created_at,
    },
    task_states: (taskStates ?? []).map((s) => ({
      task_id: s.task_id,
      status: s.status as 'todo' | 'in_progress' | 'done' | 'skipped',
      writing_reps: s.writing_reps ?? 0,
      kana_accuracy: s.kana_accuracy ?? null,
      speaking_minutes: s.speaking_minutes ?? 0,
      pinned_start: s.pinned_start ?? null,
      done_on: s.done_on ?? null,
    })),
    resource_states: (resourceStates ?? []).map((s) => ({
      resource_id: s.resource_id,
      status: s.status as 'none' | 'owned' | 'ordered' | 'received' | 'not_needed',
      opted_in: s.opted_in,
      ordered_on: s.ordered_on ?? null,
      eta: s.eta ?? null,
    })),
  };
}

// ── Import ───────────────────────────────────────────────────────────────────

/**
 * Kiểm tra tính hợp lệ của JSON string và gọi RPC import_user_plan.
 * Lỗi schema → ném AppError mô tả cụ thể để người dùng biết file bị lỗi ở đâu.
 * Thành công → void.
 */
export async function importPlan(supabase: SupabaseClient, jsonString: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError('Chưa đăng nhập.', 'UNAUTHENTICATED', 401);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new AppError('File không phải JSON hợp lệ.', 'INVALID_JSON', 400);
  }

  const validated = backupDataSchema.safeParse(parsed);
  if (!validated.success) {
    const firstIssue = validated.error.issues[0];
    const path = firstIssue?.path.join('.') ?? 'unknown';
    const msg = firstIssue?.message ?? 'Định dạng không hợp lệ.';
    throw new AppError(`File sao lưu không hợp lệ (${path}): ${msg}`, 'INVALID_BACKUP', 400);
  }

  const { error } = await supabase.rpc('import_user_plan', { p_json: validated.data });
  if (error) {
    // Ném thông điệp từ DB (RPC đã dùng RAISE EXCEPTION với mô tả tiếng Việt)
    throw new AppError(error.message, 'RPC_ERROR', 500);
  }
}
