import { createClient, getCurrentUser } from '@/lib/supabase/server';

export interface MilestoneStats {
  milestone: string;
  taskCount: number;
  doneCount: number;
  totalWritingReps: number;
  totalSpeakingMinutes: number;
}

export interface ProgressStats {
  totalTasks: number;
  doneTasks: number;
  byMilestone: MilestoneStats[];
}

/** Tổng tiến độ + thống kê viết/nói gộp theo milestone, cho vòng tròn tiến độ ở /roadmap. */
export async function loadProgressStats(): Promise<ProgressStats | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: plan } = await supabase.from('plans').select('id, template_id').limit(1).maybeSingle();
  if (!plan) return null;

  const [{ data: tasks }, { data: states }] = await Promise.all([
    supabase.from('template_tasks').select('id, milestone').eq('template_id', plan.template_id),
    supabase.from('plan_task_state').select('task_id, status, writing_reps, speaking_minutes').eq('plan_id', plan.id),
  ]);
  if (!tasks || !states) return null;

  const stateByTaskId = new Map(states.map((s) => [s.task_id, s]));
  const byMilestone = new Map<string, MilestoneStats>();
  let doneTasks = 0;

  for (const t of tasks) {
    const state = stateByTaskId.get(t.id);
    if (state?.status === 'skipped') continue; // task tùy chọn đã tắt — không tính vào "việc phải làm"
    const milestone = t.milestone ?? 'Khác';
    const entry = byMilestone.get(milestone) ?? {
      milestone,
      taskCount: 0,
      doneCount: 0,
      totalWritingReps: 0,
      totalSpeakingMinutes: 0,
    };
    entry.taskCount += 1;
    if (state?.status === 'done') {
      entry.doneCount += 1;
      doneTasks += 1;
    }
    entry.totalWritingReps += state?.writing_reps ?? 0;
    entry.totalSpeakingMinutes += state?.speaking_minutes ?? 0;
    byMilestone.set(milestone, entry);
  }

  const milestoneList = [...byMilestone.values()];
  const totalTasks = milestoneList.reduce((s, m) => s + m.taskCount, 0);

  return { totalTasks, doneTasks, byMilestone: milestoneList };
}
