/**
 * Ghép dữ liệu đọc từ Supabase (template_tasks + plan_task_state) thành TaskInput[] cho computeSchedule.
 * Hàm thuần: không đọc DB, không đọc đồng hồ. Trạng thái 'skipped' cho task optional được QUYẾT ĐỊNH
 * từ trước (lúc tạo plan, xem RPC create_plan) và LƯU trong plan_task_state — hàm này chỉ đọc lại
 * đúng trạng thái đã lưu, không tự suy luận từ cờ `optional`.
 */
import type { Status, TaskInput } from './schedule';

export interface TemplateTaskRow {
  id: string;
  estHours: number;
  optional: boolean;
  sort: number;
}

export interface PlanTaskStateRow {
  taskId: string;
  status: Status;
  pinnedStart?: string | null;
}

export function toTaskInputs(templateTasks: TemplateTaskRow[], states: PlanTaskStateRow[]): TaskInput[] {
  const stateByTaskId = new Map(states.map((s) => [s.taskId, s]));
  return [...templateTasks]
    .sort((a, b) => a.sort - b.sort)
    .map((t) => {
      const state = stateByTaskId.get(t.id);
      return {
        id: t.id,
        estHours: t.estHours,
        status: state?.status ?? 'todo',
        pinnedStart: state?.pinnedStart ?? null,
      };
    });
}
