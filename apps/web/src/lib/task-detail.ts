import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { Status } from '@roadmap/core';

export interface TaskDetail {
  id: string;
  code: string;
  name: string;
  milestone: string | null;
  deliverable: string | null;
  toolNote: string | null;
  estHours: number;
  writingTarget: number;
  optional: boolean;
  sort: number;
  status: Status;
  pinnedStart: string | null;
  writingReps: number;
  kanaAccuracy: number | null;
  speakingMinutes: number;
  prevTaskId: string | null;
  nextTaskId: string | null;
}

/** Đọc toàn bộ thông tin 1 task (nội dung template + tiến độ cá nhân) cho trang chi tiết task. */
export async function loadTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: task } = await supabase
    .from('template_tasks')
    .select('id, template_id, code, name, milestone, deliverable, tool_note, est_hours, writing_target, optional, sort')
    .eq('id', taskId)
    .maybeSingle();
  if (!task) return null;

  const [{ data: state }, { data: prev }, { data: next }] = await Promise.all([
    supabase
      .from('plan_task_state')
      .select('status, pinned_start, writing_reps, kana_accuracy, speaking_minutes')
      .eq('task_id', taskId)
      .maybeSingle(),
    supabase
      .from('template_tasks')
      .select('id')
      .eq('template_id', task.template_id)
      .lt('sort', task.sort)
      .order('sort', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('template_tasks')
      .select('id')
      .eq('template_id', task.template_id)
      .gt('sort', task.sort)
      .order('sort', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!state) return null;

  return {
    id: task.id,
    code: task.code,
    name: task.name,
    milestone: task.milestone,
    deliverable: task.deliverable,
    toolNote: task.tool_note,
    estHours: Number(task.est_hours),
    writingTarget: task.writing_target,
    optional: task.optional,
    sort: task.sort,
    status: state.status as Status,
    pinnedStart: state.pinned_start,
    writingReps: state.writing_reps,
    kanaAccuracy: state.kana_accuracy === null ? null : Number(state.kana_accuracy),
    speakingMinutes: state.speaking_minutes,
    prevTaskId: prev?.id ?? null,
    nextTaskId: next?.id ?? null,
  };
}
