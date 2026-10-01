import type { RoadmapRow } from '@/lib/roadmap';
import { copy } from '@/lib/copy';

const statusLabel: Record<RoadmapRow['status'], string> = {
  todo: copy.roadmapStatusTodo,
  in_progress: copy.roadmapStatusInProgress,
  done: copy.roadmapStatusDone,
  skipped: copy.roadmapStatusSkipped,
};

/**
 * Hàng hiển thị 1 task (dùng chung cho /roadmap, và mọi màn sau này cần hiển thị task tương tự).
 * Bố cục CỐ ĐỊNH bằng CSS Grid (cột tên co giãn, cột nhãn trạng thái giữ nguyên bề rộng tự nhiên)
 * thay vì flex-wrap — flex-wrap trước đây khiến nhãn trạng thái rớt xuống dòng dưới tùy độ dài tên
 * task, vì cả hai span đều là flex item không có cột cố định nên cùng tranh chỗ trên một hàng.
 */
export function TaskRow({
  row,
  isCurrent,
  actions,
}: {
  row: RoadmapRow;
  isCurrent: boolean;
  actions?: React.ReactNode;
}) {
  const hasDates = row.status === 'todo' || row.status === 'in_progress';
  const dimmed = row.status === 'skipped';
  return (
    <li
      id={`task-${row.id}`}
      className={`flex flex-col gap-2 rounded-md border p-3 ${isCurrent ? 'border-accent' : 'border-line'} ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
        <span className="min-w-0 text-sm font-medium break-words text-ink">
          {row.name}
          {row.optional ? <span className="ml-1 text-xs text-ink-faint">{copy.roadmapOptionalTag}</span> : null}
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted">{statusLabel[row.status]}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-faint">
        <span>{copy.roadmapEstHoursLabel(row.estHours)}</span>
        <span>
          {hasDates ? `${row.start ?? copy.roadmapNoDates} → ${row.due ?? copy.roadmapNoDates}` : copy.roadmapNoDates}
        </span>
      </div>
      {actions}
    </li>
  );
}
