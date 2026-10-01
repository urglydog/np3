// Chạy: npx tsx run-golden.mts  (so sánh bộ tính lịch với đáp án chuẩn lấy từ file Sheet)
import { readFileSync } from 'node:fs';
import { computeSchedule, delayTask, insertBreak, pinTask, type Settings, type Status, type TaskInput } from '../src/schedule';

interface GoldenTask { id: string; est: number; status: string; start: string; due: string; cum: number }
interface GoldenScenario { name: string; tasks: GoldenTask[]; settings: Settings; today: string; expected: { finish: string; remainingHours: number } }
const golden: { scenarios: GoldenScenario[] } = JSON.parse(readFileSync(new URL('./fixtures/golden-vectors.json', import.meta.url), 'utf8'));
let fails = 0, checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

for (const sc of golden.scenarios) {
  const tasks: TaskInput[] = sc.tasks.map((t) => ({ id: t.id, estHours: t.est, status: t.status.toLowerCase().replace(' ', '_') as Status }));
  const res = computeSchedule(tasks, sc.settings, sc.today);
  sc.tasks.forEach((t, i: number) => {
    eq(`${sc.name} ${t.id} start`, res.tasks[i].start, t.start);
    eq(`${sc.name} ${t.id} due`, res.tasks[i].due, t.due);
    eq(`${sc.name} ${t.id} cum`, res.tasks[i].cumHours, t.cum);
  });
  eq(`${sc.name} finish`, res.finish, sc.expected.finish);
  eq(`${sc.name} remaining`, res.remainingHours, sc.expected.remainingHours);
  console.log(`ok  ${sc.name}: ${sc.tasks.length} task, finish ${res.finish}`);
}

// ---- Thao tác Hoãn / Ghim / Nghỉ: đáp án tính tay
// 3 task, 2 giờ/ngày x 7 ngày/tuần = 2 giờ mỗi ngày lịch. A=4h, B=6h, C=2h. Bắt đầu 2026-10-01.
const S = { startDate: '2026-10-01', hoursPerDay: 2, daysPerWeek: 7 };
const T = (id: string, h: number, status: Status = 'todo'): TaskInput => ({ id, estHours: h, status });
const base = [T('A', 4), T('B', 6), T('C', 2)];
const get = (r: ReturnType<typeof computeSchedule>, id: string) => r.tasks.find((t) => t.id === id)!;
let r = computeSchedule(base, S, '2026-09-20');
eq('base A', [get(r,'A').start, get(r,'A').due], ['2026-10-01', '2026-10-02']);
eq('base B', [get(r,'B').start, get(r,'B').due], ['2026-10-03', '2026-10-05']);
eq('base C', [get(r,'C').start, get(r,'C').due], ['2026-10-06', '2026-10-06']);
// Hoãn B 5 ngày: A không đổi, B và C dời đúng 5 ngày
r = computeSchedule(delayTask(base, S, '2026-09-20', 'B', 5), S, '2026-09-20');
eq('delay A', [get(r,'A').start, get(r,'A').due], ['2026-10-01', '2026-10-02']);
eq('delay B', [get(r,'B').start, get(r,'B').due], ['2026-10-08', '2026-10-10']);
eq('delay C', [get(r,'C').start, get(r,'C').due], ['2026-10-11', '2026-10-11']);
// Ghim C vào 2026-10-20: tạo khoảng nghỉ, không báo trùng
r = computeSchedule(pinTask(base, 'C', '2026-10-20'), S, '2026-09-20');
eq('pin later C', [get(r,'C').start, get(r,'C').due, get(r,'C').conflict], ['2026-10-20', '2026-10-20', false]);
// Ghim C sớm hơn lịch (2026-10-04 < 10-06): vẫn tôn trọng nhưng báo trùng
r = computeSchedule(pinTask(base, 'C', '2026-10-04'), S, '2026-09-20');
eq('pin earlier C', [get(r,'C').start, get(r,'C').conflict], ['2026-10-04', true]);
// Nghỉ 3 ngày từ 2026-10-03: B (Start 10-03) và C dời 3 ngày
r = computeSchedule(insertBreak(base, S, '2026-09-20', '2026-10-03', 3), S, '2026-09-20');
eq('break B', [get(r,'B').start, get(r,'B').due], ['2026-10-06', '2026-10-08']);
eq('break C', [get(r,'C').start], ['2026-10-09']);
// Done/Skipped không chiếm lịch: A done -> B bắt đầu từ ngày bắt đầu hiệu lực
r = computeSchedule([T('A', 4, 'done'), T('B', 6), T('C', 2)], S, '2026-09-20');
eq('A done', [get(r,'A').start, get(r,'B').start, get(r,'B').due], [null, '2026-10-01', '2026-10-03']);
// Lịch trượt theo hôm nay: bắt đầu đã qua -> neo về hôm nay
r = computeSchedule(base, { ...S, startDate: '2026-09-01' }, '2026-09-30');
eq('rolling anchor', [r.anchor, get(r,'A').start], ['2026-09-30', '2026-09-30']);
// Ghim ở quá khứ hết hiệu lực
r = computeSchedule(pinTask(base, 'B', '2026-09-10'), S, '2026-09-20');
eq('past pin clamped', [get(r,'B').pinClamped], [true]);
// Kiểm tra đầu vào
for (const [label, fn] of [
  ['ngày không tồn tại', () => computeSchedule(base, { ...S, startDate: '2026-02-30' }, '2026-09-20')],
  ['giờ/ngày = 0', () => computeSchedule(base, { ...S, hoursPerDay: 0 }, '2026-09-20')],
  ['ngày/tuần = 8', () => computeSchedule(base, { ...S, daysPerWeek: 8 }, '2026-09-20')],
  ['estHours = 0', () => computeSchedule([T('X', 0)], S, '2026-09-20')],
] as const) { checks++; try { fn(); fails++; console.error(`FAIL phải ném lỗi: ${label}`); } catch { /* đúng */ } }

console.log(`\n${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
