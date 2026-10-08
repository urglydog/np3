import type { ScheduledTask, Status } from '@roadmap/core';
import type { TemplateTaskOutline } from './template';
import type { PlanTaskInfo } from './plan';

export interface RoadmapRow {
  id: string;
  code: string;
  name: string;
  sort: number;
  phaseCode: string;
  estHours: number;
  optional: boolean;
  status: Status;
  start: string | null;
  due: string | null;
  pinnedStart: string | null;
}

/**
 * Ghép TemplateTaskOutline (tên/giờ ước tính/Phase) với ScheduledTask (trạng thái/Start/Due đã tính
 * sẵn bằng @roadmap/core) theo id. Không tính lại lịch ở đây — chỉ nối dữ liệu để hiển thị.
 * Ném lỗi (không âm thầm bỏ qua) nếu outline và lịch lệch nhau, vì đó là dấu hiệu bug ở nơi đọc dữ liệu.
 */
export function buildRoadmapRows(
  outlineTasks: TemplateTaskOutline[],
  scheduleTasks: ScheduledTask[],
  pinnedStartById: Map<string, string | null> = new Map()
): RoadmapRow[] {
  const scheduleById = new Map(scheduleTasks.map((t) => [t.id, t]));
  const outlineIds = new Set(outlineTasks.map((t) => t.id));

  const missingInSchedule = outlineTasks.filter((t) => !scheduleById.has(t.id));
  if (missingInSchedule.length > 0) {
    throw new Error(
      `buildRoadmapRows: ${missingInSchedule.length} task có trong template nhưng thiếu trong lịch (vd mã ${missingInSchedule[0].code})`
    );
  }
  const missingInOutline = scheduleTasks.filter((t) => !outlineIds.has(t.id));
  if (missingInOutline.length > 0) {
    throw new Error(
      `buildRoadmapRows: ${missingInOutline.length} task có trong lịch nhưng thiếu trong template (id ${missingInOutline[0].id})`
    );
  }

  return outlineTasks.map((t) => {
    const s = scheduleById.get(t.id)!;
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      sort: t.sort,
      phaseCode: t.phaseCode,
      estHours: t.estHours,
      optional: t.optional,
      status: s.status,
      start: s.start,
      due: s.due,
      pinnedStart: pinnedStartById.get(t.id) ?? null,
    };
  });
}

export interface PhraseMatrixItem {
  id: string;
  index: number; // thứ tự trong milestone, dùng làm mã ngắn hiển thị trong ô
  status: Status;
}
export interface PhraseMatrixGroup {
  milestone: string;
  items: PhraseMatrixItem[];
}

/**
 * Nhóm task theo `milestone` (coi mỗi milestone là 1 "Phrase") giữ nguyên thứ tự xuất hiện trong
 * lịch (đã sort theo `sort`), đánh số 1..N trong từng nhóm — chỉ phục vụ hiển thị ma trận ở Hôm nay,
 * không phải logic lịch nên không đặt trong packages/core.
 */
export function buildPhraseMatrix(
  scheduleTasks: ScheduledTask[],
  taskInfoById: Map<string, PlanTaskInfo>
): PhraseMatrixGroup[] {
  const byMilestone = new Map<string, PhraseMatrixItem[]>();
  for (const t of scheduleTasks) {
    const milestone = taskInfoById.get(t.id)?.milestone ?? 'Khác';
    const items = byMilestone.get(milestone) ?? [];
    items.push({ id: t.id, index: items.length + 1, status: t.status });
    byMilestone.set(milestone, items);
  }
  return [...byMilestone.entries()].map(([milestone, items]) => ({ milestone, items }));
}
