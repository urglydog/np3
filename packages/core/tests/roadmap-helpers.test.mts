// Kiểm tra groupTasksByPhase và currentTaskId: phục vụ màn Lộ trình + dùng chung "task hiện tại".
import { readFileSync } from 'node:fs';
import { groupTasksByPhase, type PhaseInput } from '../src/phase-grouping';
import { currentTaskId, type ScheduledTask } from '../src/schedule';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

interface TplTask {
  code: string;
  phase: string;
  sort: number;
}
interface TplPhase {
  code: string;
  title: string;
  sort: number;
}
const tpl: { tasks: TplTask[]; phases: TplPhase[] } = JSON.parse(
  readFileSync(new URL('./fixtures/n3-template.json', import.meta.url), 'utf8')
);

const phases: PhaseInput[] = tpl.phases.map((p) => ({ code: p.code, title: p.title, sort: p.sort }));
const tasks = tpl.tasks.map((t) => ({ id: t.code, phaseCode: t.phase, sort: t.sort }));

// ----- groupTasksByPhase -----
{
  const groups = groupTasksByPhase(phases, tasks);
  eq('đủ 4 nhóm (khớp số Phase của N3)', groups.length, phases.length);
  eq('tổng task = 113', groups.reduce((n, g) => n + g.tasks.length, 0), 113);
  eq('nhóm theo đúng thứ tự sort của Phase', groups.map((g) => g.code), [...phases].sort((a, b) => a.sort - b.sort).map((p) => p.code));

  let orderOk = true;
  let oneGroupEachOk = true;
  const seen = new Set<string>();
  for (const g of groups) {
    for (let i = 1; i < g.tasks.length; i++) if (g.tasks[i].sort < g.tasks[i - 1].sort) orderOk = false;
    for (const t of g.tasks) {
      if (seen.has(t.id)) oneGroupEachOk = false;
      seen.add(t.id);
    }
  }
  eq('task trong mỗi nhóm đúng thứ tự sort', orderOk, true);
  eq('mỗi task chỉ thuộc đúng 1 nhóm', oneGroupEachOk, true);
  eq('không thiếu/thừa task nào', seen.size, 113);
}

// Phase rỗng (không có task nào) không tạo nhóm
{
  const phasesWithEmpty: PhaseInput[] = [...phases, { code: 'phase-rong', title: 'Phase rỗng', sort: 999 }];
  const groups = groupTasksByPhase(phasesWithEmpty, tasks);
  eq('Phase rỗng bị loại khỏi kết quả', groups.some((g) => g.code === 'phase-rong'), false);
  eq('số nhóm không đổi khi thêm Phase rỗng', groups.length, phases.length);
}

// ----- currentTaskId -----
const T = (id: string, status: ScheduledTask['status']): ScheduledTask => ({
  id,
  status,
  start: null,
  due: null,
  cumHours: 0,
  conflict: false,
  pinClamped: false,
});

eq('todo đầu tiên khi không có in_progress', currentTaskId([T('A', 'done'), T('B', 'todo'), T('C', 'todo')]), 'B');
eq('ưu tiên in_progress dù đứng sau todo trong mảng', currentTaskId([T('A', 'todo'), T('B', 'in_progress'), T('C', 'todo')]), 'B');
eq('hết task (toàn done/skipped) -> null', currentTaskId([T('A', 'done'), T('B', 'skipped')]), null);
eq('mảng rỗng -> null', currentTaskId([]), null);

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
