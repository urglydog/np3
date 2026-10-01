import type { ScheduledTask, Status } from '@roadmap/core';
import type { TemplateTaskOutline } from './template';

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
  writingTarget: number;
  writingReps: number;
  kanaAccuracy: number | null;
  speakingMinutes: number;
}

export interface TrackingRow {
  writingReps: number;
  kanaAccuracy: number | null;
  speakingMinutes: number;
}

/**
 * Ghép TemplateTaskOutline (tên/giờ ước tính/Phase) với ScheduledTask (trạng thái/Start/Due đã tính
 * sẵn bằng @roadmap/core) theo id. Không tính lại lịch ở đây — chỉ nối dữ liệu để hiển thị.
 * Ném lỗi (không âm thầm bỏ qua) nếu outline và lịch lệch nhau, vì đó là dấu hiệu bug ở nơi đọc dữ liệu.
 */
export function buildRoadmapRows(
  outlineTasks: TemplateTaskOutline[],
  scheduleTasks: ScheduledTask[],
  pinnedStartById: Map<string, string | null> = new Map(),
  trackingById: Map<string, TrackingRow> = new Map()
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
    const tracking = trackingById.get(t.id);
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
      writingTarget: t.writingTarget,
      writingReps: tracking?.writingReps ?? 0,
      kanaAccuracy: tracking?.kanaAccuracy ?? null,
      speakingMinutes: tracking?.speakingMinutes ?? 0,
    };
  });
}
