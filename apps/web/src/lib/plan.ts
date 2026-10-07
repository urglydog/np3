import { computeSchedule, toTaskInputs, todayInTimeZone, type ScheduleResult } from '@roadmap/core';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export interface PlanTaskInfo {
  name: string;
  milestone: string | null;
}

export interface PlanSchedule {
  planId: string;
  timezone: string;
  today: string;
  schedule: ScheduleResult;
  taskInfoById: Map<string, PlanTaskInfo>;
  pinnedStartById: Map<string, string | null>;
}

/**
 * Đọc plan của user hiện tại (RLS tự giới hạn) và tính lịch bằng @roadmap/core.
 * Không lưu Start/Due vào DB — chỉ tính lại mỗi lần gọi từ start_date/hours_per_day/days_per_week/status.
 */
export async function loadCurrentPlanSchedule(): Promise<PlanSchedule | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .limit(1)
    .maybeSingle();
  if (!plan) return null;

  const [{ data: templateTasks }, { data: planTaskStates }] = await Promise.all([
    supabase
      .from('template_tasks')
      .select('id, name, milestone, est_hours, optional, sort')
      .eq('template_id', plan.template_id)
      .order('sort'),
    supabase.from('plan_task_state').select('task_id, status, pinned_start').eq('plan_id', plan.id),
  ]);

  const inputs = toTaskInputs(
    (templateTasks ?? []).map((t) => ({ id: t.id, estHours: Number(t.est_hours), optional: t.optional, sort: t.sort })),
    (planTaskStates ?? []).map((s) => ({ taskId: s.task_id, status: s.status, pinnedStart: s.pinned_start }))
  );

  const today = todayInTimeZone(plan.timezone);
  const schedule = computeSchedule(
    inputs,
    { startDate: plan.start_date, hoursPerDay: Number(plan.hours_per_day), daysPerWeek: plan.days_per_week },
    today
  );

  const taskInfoById = new Map<string, PlanTaskInfo>(
    (templateTasks ?? []).map((t) => [t.id, { name: t.name, milestone: t.milestone }])
  );
  const pinnedStartById = new Map<string, string | null>(
    (planTaskStates ?? []).map((s) => [s.task_id, s.pinned_start])
  );

  return { planId: plan.id, timezone: plan.timezone, today, schedule, taskInfoById, pinnedStartById };
}
