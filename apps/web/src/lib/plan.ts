import { computeSchedule, toTaskInputs, todayInTimeZone, writingMastery, type ScheduleResult } from '@roadmap/core';
import { createClient } from '@/lib/supabase/server';

export interface PlanTaskInfo {
  name: string;
  milestone: string | null;
  writingTarget: number;
  writingReps: number;
  kanaAccuracy: number | null;
  speakingMinutes: number;
}

export interface TrackingStats {
  totalWritingReps: number;
  totalSpeakingMinutes: number;
  writingMastery: number;
}

export interface PlanSchedule {
  planId: string;
  timezone: string;
  today: string;
  schedule: ScheduleResult;
  taskInfoById: Map<string, PlanTaskInfo>;
  pinnedStartById: Map<string, string | null>;
  trackingStats: TrackingStats;
}

/**
 * Đọc plan của user hiện tại (RLS tự giới hạn) và tính lịch bằng @roadmap/core.
 * Không lưu Start/Due vào DB — chỉ tính lại mỗi lần gọi từ start_date/hours_per_day/days_per_week/status.
 */
export async function loadCurrentPlanSchedule(): Promise<PlanSchedule | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: plan } = await supabase
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .limit(1)
    .maybeSingle();
  if (!plan) return null;

  const { data: templateTasks } = await supabase
    .from('template_tasks')
    .select('id, name, milestone, est_hours, optional, sort, writing_target')
    .eq('template_id', plan.template_id)
    .order('sort');

  const { data: planTaskStates } = await supabase
    .from('plan_task_state')
    .select('task_id, status, pinned_start, writing_reps, kana_accuracy, speaking_minutes')
    .eq('plan_id', plan.id);

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

  const trackingByTaskId = new Map((planTaskStates ?? []).map((s) => [s.task_id, s]));
  const taskInfoById = new Map<string, PlanTaskInfo>(
    (templateTasks ?? []).map((t) => {
      const tracking = trackingByTaskId.get(t.id);
      return [
        t.id,
        {
          name: t.name,
          milestone: t.milestone,
          writingTarget: t.writing_target,
          writingReps: tracking?.writing_reps ?? 0,
          kanaAccuracy: tracking?.kana_accuracy ?? null,
          speakingMinutes: tracking?.speaking_minutes ?? 0,
        },
      ];
    })
  );
  const pinnedStartById = new Map<string, string | null>((planTaskStates ?? []).map((s) => [s.task_id, s.pinned_start]));

  const totalWritingReps = (planTaskStates ?? []).reduce((sum, s) => sum + (s.writing_reps ?? 0), 0);
  const totalSpeakingMinutes = (planTaskStates ?? []).reduce((sum, s) => sum + (s.speaking_minutes ?? 0), 0);
  const mastery = writingMastery(
    (templateTasks ?? []).map((t) => ({
      writingTarget: t.writing_target,
      writingReps: trackingByTaskId.get(t.id)?.writing_reps ?? 0,
    }))
  );

  return {
    planId: plan.id,
    timezone: plan.timezone,
    today,
    schedule,
    taskInfoById,
    pinnedStartById,
    trackingStats: { totalWritingReps, totalSpeakingMinutes, writingMastery: mastery },
  };
}
