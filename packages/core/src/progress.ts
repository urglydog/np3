/**
 * Hàm thuần phục vụ màn "đã học đến đâu": chỉ dùng để HIỂN THỊ xem trước (sẽ đổi bao nhiêu task,
 * task tiếp theo là gì). Nguồn sự thật cho việc GHI dữ liệu vẫn là RPC phía DB (create_plan,
 * update_plan_progress) — hai nơi phải cùng một luật "sort <= ngưỡng và đang todo/in_progress",
 * nên đặt chung ở đây để không lệch nhau.
 */
import type { Status } from './schedule';

export interface TaskProgressRow {
  id: string;
  sort: number;
  status: Status;
}

/** Id các task sẽ chuyển thành 'done' nếu đánh dấu xong tới ngưỡng `upToSort`, sắp theo sort tăng dần. */
export function tasksToMarkDone(tasks: TaskProgressRow[], upToSort: number): string[] {
  return [...tasks]
    .filter((t) => t.sort <= upToSort && (t.status === 'todo' || t.status === 'in_progress'))
    .sort((a, b) => a.sort - b.sort)
    .map((t) => t.id);
}

/** Task kế tiếp sau khi đã đánh dấu xong tới ngưỡng `upToSort` (bỏ qua task done/skipped). null nếu hết. */
export function nextTaskAfter(tasks: TaskProgressRow[], upToSort: number): TaskProgressRow | null {
  const after = [...tasks]
    .filter((t) => t.sort > upToSort && t.status !== 'done' && t.status !== 'skipped')
    .sort((a, b) => a.sort - b.sort);
  return after[0] ?? null;
}
