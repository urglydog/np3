// Kiểm tra toTaskInputs: ghép template_tasks + plan_task_state thành TaskInput[] cho computeSchedule.
import { readFileSync } from 'node:fs';
import { computeSchedule } from '../src/schedule';
import { toTaskInputs, type PlanTaskStateRow, type TemplateTaskRow } from '../src/plan-mapping';

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
  est_hours: number;
  optional: boolean;
  sort: number;
}
const tpl: { tasks: TplTask[] } = JSON.parse(readFileSync(new URL('./fixtures/n3-template.json', import.meta.url), 'utf8'));

const templateTasks: TemplateTaskRow[] = tpl.tasks.map((t) => ({
  id: t.code,
  estHours: t.est_hours,
  optional: t.optional,
  sort: t.sort,
}));

const settings = { startDate: '2026-10-01', hoursPerDay: 2, daysPerWeek: 6 };
const today = '2026-10-01';

// (a) tất cả todo, không có plan_task_state override -> khớp đúng golden "default-all-todo"
{
  const inputs = toTaskInputs(templateTasks, []);
  eq('(a) đủ 113 task', inputs.length, 113);
  eq('(a) mặc định todo', inputs.every((t) => t.status === 'todo'), true);
  const res = computeSchedule(inputs, settings, today);
  eq('(a) finish khớp golden default-all-todo', res.finish, '2027-08-27');
  eq('(a) remainingHours = 566', res.remainingHours, 566);
}

// (b) include_optional=false -> task optional bị skipped (giống RPC create_plan) -> còn 425h
{
  const states: PlanTaskStateRow[] = tpl.tasks
    .filter((t) => t.optional)
    .map((t) => ({ taskId: t.code, status: 'skipped' as const }));
  const inputs = toTaskInputs(templateTasks, states);
  const res = computeSchedule(inputs, settings, today);
  eq('(b) remainingHours = 425 khi loại optional', res.remainingHours, 425);
}

// (c) thứ tự output luôn theo cột sort, bất kể thứ tự đầu vào
{
  const shuffled = [...templateTasks].reverse();
  const expectedOrder = [...templateTasks].sort((a, b) => a.sort - b.sort).map((t) => t.id);
  const inputs = toTaskInputs(shuffled, []);
  eq('(c) output theo đúng thứ tự sort', inputs.map((t) => t.id), expectedOrder);
}

// (d) trạng thái lấy từ plan_task_state, không tự suy luận từ cờ optional
{
  const optionalTask = tpl.tasks.find((t) => t.optional);
  const requiredTask = tpl.tasks.find((t) => !t.optional);
  if (!optionalTask || !requiredTask) throw new Error('fixture thiếu task optional hoặc bắt buộc để test (d)');
  const states: PlanTaskStateRow[] = [
    { taskId: optionalTask.code, status: 'todo' }, // optional nhưng state nói todo -> phải giữ 'todo'
    { taskId: requiredTask.code, status: 'skipped' }, // bắt buộc nhưng state nói skipped -> phải giữ 'skipped'
  ];
  const inputs = toTaskInputs(templateTasks, states);
  const byId = new Map(inputs.map((t) => [t.id, t]));
  eq('(d) optional nhưng state=todo thì giữ todo', byId.get(optionalTask.code)?.status, 'todo');
  eq('(d) bắt buộc nhưng state=skipped thì giữ skipped', byId.get(requiredTask.code)?.status, 'skipped');
}

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
if (fails > 0) process.exit(1);
