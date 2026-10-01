// Kiểm thử tích hợp: Nghỉ N ngày từ một ngày (insertBreakInDb). Cần Supabase local. KHÔNG db reset.
import { computeSchedule, toTaskInputs, todayInTimeZone } from '@roadmap/core';
import { createTestUser, createBasePlan, deleteTestUser, makeChecker } from './integration-helpers.mts';
import { insertBreakInDb } from '../apps/web/src/lib/schedule-mutations.ts';

const { eq, report } = makeChecker();
const userA = await createTestUser('break-a');
const userB = await createTestUser('break-b');

async function readSchedule(client: typeof userA.client) {
  const { data: plan } = await client
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .limit(1)
    .single();
  const { data: templateTasks } = await client
    .from('template_tasks')
    .select('id, est_hours, optional, sort')
    .eq('template_id', plan!.template_id)
    .order('sort');
  const { data: states } = await client.from('plan_task_state').select('task_id, status, pinned_start').eq('plan_id', plan!.id);
  const inputs = toTaskInputs(
    templateTasks!.map((t) => ({ id: t.id, estHours: Number(t.est_hours), optional: t.optional, sort: t.sort })),
    states!.map((s) => ({ taskId: s.task_id, status: s.status, pinnedStart: s.pinned_start }))
  );
  const today = todayInTimeZone(plan!.timezone);
  const settings = { startDate: plan!.start_date, hoursPerDay: Number(plan!.hours_per_day), daysPerWeek: plan!.days_per_week };
  return { plan: plan!, schedule: computeSchedule(inputs, settings, today) };
}

try {
  await createBasePlan(userA.client);
  await createBasePlan(userB.client);

  const before = await readSchedule(userA.client);

  // Nghỉ từ đúng ngày bắt đầu plan: task đầu tiên (đang có start = ngày đó) phải bị dời đúng N ngày
  const firstTodo = before.schedule.tasks.find((t) => t.status === 'todo')!;
  const breakDays = 4;
  const result = await insertBreakInDb(userA.client, before.plan.start_date, breakDays);
  eq('Có task bị ảnh hưởng (không phải no-op)', result.noTaskAffected, false);
  eq('Task bị dời đúng là task đầu tiên', result.taskId, firstTodo.id);

  const after = await readSchedule(userA.client);
  const afterFirst = after.schedule.tasks.find((t) => t.id === firstTodo.id)!;
  const expectedStart = new Date(firstTodo.start!);
  expectedStart.setUTCDate(expectedStart.getUTCDate() + breakDays);
  eq('Start mới = start cũ + N ngày (đối chiếu core tính độc lập)', afterFirst.start, expectedStart.toISOString().slice(0, 10));

  // Nghỉ từ một ngày RẤT xa trong tương lai (sau khi mọi task đã xong) -> không có task nào bị ảnh hưởng
  const farFuture = '2099-01-01';
  const noopResult = await insertBreakInDb(userA.client, farFuture, 2);
  eq('Nghỉ từ ngày quá xa -> không đổi gì (noTaskAffected=true)', noopResult.noTaskAffected, true);

  // B áp dụng nghỉ: chỉ ảnh hưởng plan của B, không đụng A
  const beforeA = await userA.client.from('plan_task_state').select('task_id, pinned_start').eq('plan_id', before.plan.id);
  await insertBreakInDb(userB.client, before.plan.start_date, 7);
  const afterA = await userA.client.from('plan_task_state').select('task_id, pinned_start').eq('plan_id', before.plan.id);
  eq('B áp dụng nghỉ không ảnh hưởng dữ liệu của A', afterA.data, beforeA.data);

  report();
} finally {
  await deleteTestUser(userA);
  await deleteTestUser(userB);
}
