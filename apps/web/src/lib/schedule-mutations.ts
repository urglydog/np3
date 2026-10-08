import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeSchedule,
  toTaskInputs,
  todayInTimeZone,
  delayTask,
  pinTask,
  insertBreak,
  type TaskInput,
  type Settings,
  type Status,
  type ScheduleResult,
} from '@roadmap/core';
import { AppError } from './errors';

/**
 * Các hàm ở đây chỉ nhận một `SupabaseClient` đã có (không tự tạo, không import `next/headers`),
 * để cả Server Action (dùng client server của Next) lẫn `scripts/test-integration.mts` (dùng client
 * thường với JWT của user test) gọi chung được một chỗ duy nhất chứa logic ghi dữ liệu.
 */

interface ScheduleContext {
  planId: string;
  settings: Settings;
  today: string;
  inputs: TaskInput[];
}

async function loadScheduleContext(supabase: SupabaseClient): Promise<ScheduleContext> {
  const { data: plan } = await supabase
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .limit(1)
    .maybeSingle();
  if (!plan) throw new AppError('Bạn chưa có lộ trình', 'no_plan', 404);

  const { data: templateTasks } = await supabase
    .from('template_tasks')
    .select('id, est_hours, optional, sort')
    .eq('template_id', plan.template_id)
    .order('sort');
  const { data: planTaskStates } = await supabase
    .from('plan_task_state')
    .select('task_id, status, pinned_start')
    .eq('plan_id', plan.id);
  if (!templateTasks || !planTaskStates) throw new AppError('Không đọc được dữ liệu lộ trình', 'read_failed', 500);

  const inputs = toTaskInputs(
    templateTasks.map((t) => ({ id: t.id, estHours: Number(t.est_hours), optional: t.optional, sort: t.sort })),
    planTaskStates.map((s) => ({ taskId: s.task_id, status: s.status as Status, pinnedStart: s.pinned_start }))
  );

  return {
    planId: plan.id,
    settings: { startDate: plan.start_date, hoursPerDay: Number(plan.hours_per_day), daysPerWeek: plan.days_per_week },
    today: todayInTimeZone(plan.timezone),
    inputs,
  };
}

function findInput(inputs: TaskInput[], taskId: string): TaskInput {
  const t = inputs.find((x) => x.id === taskId);
  if (!t) throw new AppError('Không tìm thấy task trong lộ trình', 'task_not_found', 404);
  return t;
}

async function writeStatus(supabase: SupabaseClient, planId: string, taskId: string, status: Status): Promise<void> {
  const { error } = await supabase.from('plan_task_state').update({ status }).eq('plan_id', planId).eq('task_id', taskId);
  if (error) throw new AppError(error.message, 'update_failed', 400);
}

async function writePinnedStart(supabase: SupabaseClient, planId: string, taskId: string, pinnedStart: string | null): Promise<void> {
  const { error } = await supabase
    .from('plan_task_state')
    .update({ pinned_start: pinnedStart })
    .eq('plan_id', planId)
    .eq('task_id', taskId);
  if (error) throw new AppError(error.message, 'update_failed', 400);
}

/** Ghi số lần viết/phút nói/độ chính xác tự nhập cho 1 task — không ảnh hưởng lịch (không cần recompute). */
export async function updateTaskStatsInDb(
  supabase: SupabaseClient,
  taskId: string,
  stats: { writingReps: number; speakingMinutes: number; kanaAccuracy: number | null }
): Promise<void> {
  const { data: plan } = await supabase.from('plans').select('id').limit(1).maybeSingle();
  if (!plan) throw new AppError('Bạn chưa có lộ trình', 'no_plan', 404);

  const { error } = await supabase
    .from('plan_task_state')
    .update({
      writing_reps: stats.writingReps,
      speaking_minutes: stats.speakingMinutes,
      kana_accuracy: stats.kanaAccuracy,
    })
    .eq('plan_id', plan.id)
    .eq('task_id', taskId);
  if (error) throw new AppError(error.message, 'update_failed', 400);
}

export interface MutationResult {
  taskId: string;
  status: Status;
  start: string | null;
  due: string | null;
  conflict: boolean;
  pinClamped: boolean;
  changed: boolean;
}

function toResult(schedule: ScheduleResult, taskId: string, changed: boolean): MutationResult {
  const t = schedule.tasks.find((x) => x.id === taskId);
  return {
    taskId,
    status: t?.status ?? 'todo',
    start: t?.start ?? null,
    due: t?.due ?? null,
    conflict: t?.conflict ?? false,
    pinClamped: t?.pinClamped ?? false,
    changed,
  };
}

/** Bỏ qua / Bỏ "bỏ qua": todo|in_progress ⇄ skipped. Không áp dụng cho task done. */
export async function toggleTaskSkip(supabase: SupabaseClient, taskId: string): Promise<MutationResult> {
  const ctx = await loadScheduleContext(supabase);
  const current = findInput(ctx.inputs, taskId);
  if (current.status === 'done') throw new AppError('Task đã xong, không áp dụng Bỏ qua', 'invalid_state', 400);

  const newStatus: Status = current.status === 'skipped' ? 'todo' : 'skipped';
  await writeStatus(supabase, ctx.planId, taskId, newStatus);
  const newInputs = ctx.inputs.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
  const schedule = computeSchedule(newInputs, ctx.settings, ctx.today);
  return toResult(schedule, taskId, true);
}

/**
 * Đánh dấu Xong / Bỏ đánh dấu Xong: todo|in_progress ⇄ done. Không áp dụng cho task đã bỏ qua
 * (bỏ "Bỏ qua" trước ở nút riêng). Cho phép quay ngược done → todo để sửa lại mốc tiến độ khi
 * người dùng phát hiện mình nhảy cóc/hổng kiến thức, không chỉ đi tới như update_plan_progress RPC.
 */
export async function toggleDoneInDb(supabase: SupabaseClient, taskId: string): Promise<MutationResult> {
  const ctx = await loadScheduleContext(supabase);
  const current = findInput(ctx.inputs, taskId);
  if (current.status === 'skipped') throw new AppError('Task đang bị bỏ qua, bỏ "Bỏ qua" trước', 'invalid_state', 400);

  const newStatus: Status = current.status === 'done' ? 'todo' : 'done';
  await writeStatus(supabase, ctx.planId, taskId, newStatus);
  const newInputs = ctx.inputs.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
  const schedule = computeSchedule(newInputs, ctx.settings, ctx.today);
  return toResult(schedule, taskId, true);
}

/** Hoãn N ngày (delayTask từ @roadmap/core) cho task chưa xong, chưa bị bỏ qua. */
export async function delayTaskInDb(supabase: SupabaseClient, taskId: string, days: number): Promise<MutationResult> {
  const ctx = await loadScheduleContext(supabase);
  const current = findInput(ctx.inputs, taskId);
  if (current.status === 'done' || current.status === 'skipped') {
    throw new AppError('Chỉ hoãn được task chưa xong và chưa bị bỏ qua', 'invalid_state', 400);
  }

  let newInputs: TaskInput[];
  try {
    newInputs = delayTask(ctx.inputs, ctx.settings, ctx.today, taskId, days);
  } catch (e) {
    throw new AppError(e instanceof Error ? e.message : 'Hoãn thất bại', 'delay_failed', 400);
  }
  const newTarget = findInput(newInputs, taskId);
  await writePinnedStart(supabase, ctx.planId, taskId, newTarget.pinnedStart ?? null);
  const schedule = computeSchedule(newInputs, ctx.settings, ctx.today);
  return toResult(schedule, taskId, true);
}

/** Ghim ngày bắt đầu (pinTask). Không áp dụng cho task done. */
export async function pinTaskInDb(supabase: SupabaseClient, taskId: string, date: string): Promise<MutationResult> {
  const ctx = await loadScheduleContext(supabase);
  const current = findInput(ctx.inputs, taskId);
  if (current.status === 'done') throw new AppError('Task đã xong, không áp dụng Ghim ngày', 'invalid_state', 400);

  const newInputs = pinTask(ctx.inputs, taskId, date);
  await writePinnedStart(supabase, ctx.planId, taskId, date);
  const schedule = computeSchedule(newInputs, ctx.settings, ctx.today);
  return toResult(schedule, taskId, true);
}

/** Xóa ghim: đặt pinned_start về null. */
export async function unpinTaskInDb(supabase: SupabaseClient, taskId: string): Promise<MutationResult> {
  const ctx = await loadScheduleContext(supabase);
  const current = findInput(ctx.inputs, taskId);
  if (current.status === 'done') throw new AppError('Task đã xong, không áp dụng xóa ghim', 'invalid_state', 400);

  const wasPinned = current.pinnedStart != null;
  const newInputs = ctx.inputs.map((t) => (t.id === taskId ? { ...t, pinnedStart: null } : t));
  await writePinnedStart(supabase, ctx.planId, taskId, null);
  const schedule = computeSchedule(newInputs, ctx.settings, ctx.today);
  return { ...toResult(schedule, taskId, wasPinned) };
}

export interface BreakResult extends MutationResult {
  noTaskAffected: boolean;
}

/** Nghỉ N ngày kể từ một ngày (insertBreak): dời task chưa xong đầu tiên có Start >= ngày đó. */
export async function insertBreakInDb(supabase: SupabaseClient, fromDate: string, days: number): Promise<BreakResult> {
  const ctx = await loadScheduleContext(supabase);
  const newInputs = insertBreak(ctx.inputs, ctx.settings, ctx.today, fromDate, days);

  const changedTask = newInputs.find((t, i) => t.pinnedStart !== ctx.inputs[i].pinnedStart);
  if (!changedTask) {
    const schedule = computeSchedule(ctx.inputs, ctx.settings, ctx.today);
    return { ...toResult(schedule, '', false), noTaskAffected: true };
  }

  await writePinnedStart(supabase, ctx.planId, changedTask.id, changedTask.pinnedStart ?? null);
  const schedule = computeSchedule(newInputs, ctx.settings, ctx.today);
  return { ...toResult(schedule, changedTask.id, true), noTaskAffected: false };
}
