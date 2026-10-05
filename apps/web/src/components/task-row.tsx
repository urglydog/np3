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
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-all shadow-sm ${
        isCurrent ? 'border-brand bg-brand/5 shadow-brand/10' : 'border-line bg-surface-raised hover:border-brand/30'
      } ${dimmed ? 'opacity-50 grayscale' : ''}`}
    >
      <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
        <span className={`min-w-0 text-base font-semibold break-words ${isCurrent ? 'text-brand' : 'text-ink'}`}>
          {row.name}
          {row.optional ? <span className="ml-2 inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-faint border border-line">{copy.roadmapOptionalTag}</span> : null}
        </span>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
          row.status === 'done' ? 'bg-success/10 text-success border border-success/20' : 
          row.status === 'in_progress' ? 'bg-brand/10 text-brand border border-brand/20' : 
          row.status === 'skipped' ? 'bg-surface text-ink-muted border border-line' :
          'bg-surface text-ink-muted border border-line'
        }`}>
          {statusLabel[row.status]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-ink-muted">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {copy.roadmapEstHoursLabel(row.estHours)}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          {hasDates ? `${row.start ?? copy.roadmapNoDates} → ${row.due ?? copy.roadmapNoDates}` : copy.roadmapNoDates}
        </span>
      </div>
      {actions && (
        <div className="mt-2 pt-3 border-t border-line/50">
          {actions}
        </div>
      )}
    </li>
  );
}
