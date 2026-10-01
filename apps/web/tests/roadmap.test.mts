// Kiểm tra buildRoadmapRows: ghép TemplateTaskOutline + ScheduledTask theo id, không tính lại lịch.
import { buildRoadmapRows } from '../src/lib/roadmap';
import type { TemplateTaskOutline } from '../src/lib/template';
import type { ScheduledTask } from '@roadmap/core';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

const outline: TemplateTaskOutline[] = [
  { id: 'A', code: 'A', name: 'Task A', sort: 1, phaseCode: 'p1', estHours: 1, optional: false },
  { id: 'B', code: 'B', name: 'Task B', sort: 2, phaseCode: 'p1', estHours: 2, optional: true },
];
const S = (id: string, status: ScheduledTask['status']): ScheduledTask => ({
  id,
  status,
  start: status === 'done' || status === 'skipped' ? null : '2026-10-01',
  due: status === 'done' || status === 'skipped' ? null : '2026-10-02',
  cumHours: 1,
  conflict: false,
  pinClamped: false,
});

// Ghép đúng, giữ nguyên dữ liệu outline + lấy status/start/due từ schedule
{
  const rows = buildRoadmapRows(outline, [S('A', 'done'), S('B', 'skipped')]);
  eq('đủ 2 dòng, đúng thứ tự outline', rows.map((r) => r.id), ['A', 'B']);
  eq('lấy đúng status từ schedule', rows.map((r) => r.status), ['done', 'skipped']);
  eq('giữ nguyên estHours/optional từ outline', [rows[0].estHours, rows[1].optional], [1, true]);
  eq('done/skipped không có start/due', [rows[0].start, rows[1].due], [null, null]);
}

// Thiếu task trong lịch -> phải ném lỗi, không âm thầm bỏ qua
{
  let threw = false;
  try {
    buildRoadmapRows(outline, [S('A', 'todo')]); // thiếu B
  } catch {
    threw = true;
  }
  eq('thiếu task trong lịch phải ném lỗi', threw, true);
}

// Thừa task trong lịch (không có trong outline) -> phải ném lỗi
{
  let threw = false;
  try {
    buildRoadmapRows(outline, [S('A', 'todo'), S('B', 'todo'), S('C', 'todo')]); // C lạ
  } catch {
    threw = true;
  }
  eq('thừa task lạ trong lịch phải ném lỗi', threw, true);
}

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
