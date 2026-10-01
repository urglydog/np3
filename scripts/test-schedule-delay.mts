// Kiểm thử tích hợp: Hoãn N ngày (delayTaskInDb). Cần Supabase local đang chạy. KHÔNG db reset.
import { computeSchedule, toTaskInputs, todayInTimeZone } from '@roadmap/core';
import { createTestUser, createBasePlan, deleteTestUser, makeChecker } from './integration-helpers.mts';
import { delayTaskInDb } from '../apps/web/src/lib/schedule-mutations.ts';

const { eq, report } = makeChecker();
const userA = await createTestUser('delay-a');
const userB = await createTestUser('delay-b');

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
  const firstTodo = before.schedule.tasks.find((t) => t.status === 'todo')!;
  const taskId = firstTodo.id;

  const result = await delayTaskInDb(userA.client, taskId, 3);
  const { data: row } = await userA.client.from('plan_task_state').select('pinned_start').eq('task_id', taskId).single();
  eq('DB lưu đúng pinned_start = start do core tính (không conflict/clamp)', row?.pinned_start, result.start);
  eq('Không có cảnh báo conflict/pinClamped cho task đầu tiên', [result.conflict, result.pinClamped], [false, false]);

  // Đối chiếu core: tính lại độc lập từ DB, phải khớp kết quả delayTaskInDb trả về
  const after = await readSchedule(userA.client);
  const afterTarget = after.schedule.tasks.find((t) => t.id === taskId)!;
  eq('Lịch tính lại từ DB khớp kết quả trả về (start)', afterTarget.start, result.start);
  eq('Lịch tính lại từ DB khớp kết quả trả về (due)', afterTarget.due, result.due);
  eq('Start mới trễ hơn start cũ', new Date(afterTarget.start!).getTime() > new Date(firstTodo.start!).getTime(), true);

  // Task done: delayTaskInDb phải từ chối
  const { data: doneCandidate } = await userA.client.from('plan_task_state').select('task_id').neq('task_id', taskId).limit(1).maybeSingle();
  if (doneCandidate) {
    await userA.client.from('plan_task_state').update({ status: 'done' }).eq('task_id', doneCandidate.task_id);
    let threw = false;
    try {
      await delayTaskInDb(userA.client, doneCandidate.task_id, 2);
    } catch {
      threw = true;
    }
    eq('Hoãn task done phải bị từ chối', threw, true);
  }

  // B hoãn cùng mã task: chỉ đổi plan của B, không đụng A
  const beforeA = await userA.client.from('plan_task_state').select('pinned_start').eq('task_id', taskId).single();
  await delayTaskInDb(userB.client, taskId, 5);
  const afterA = await userA.client.from('plan_task_state').select('pinned_start').eq('task_id', taskId).single();
  eq('B hoãn task trùng mã không ảnh hưởng A', afterA.data?.pinned_start, beforeA.data?.pinned_start);

  report();
} finally {
  await deleteTestUser(userA);
  await deleteTestUser(userB);
}
