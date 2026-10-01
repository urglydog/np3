// Kiểm thử tích hợp: Ghim ngày / Xóa ghim (pinTaskInDb, unpinTaskInDb). Cần Supabase local. KHÔNG db reset.
import { computeSchedule, toTaskInputs, todayInTimeZone } from '@roadmap/core';
import { createTestUser, createBasePlan, deleteTestUser, makeChecker } from './integration-helpers.mts';
import { pinTaskInDb, unpinTaskInDb } from '../apps/web/src/lib/schedule-mutations.ts';

const { eq, report } = makeChecker();
const userA = await createTestUser('pin-a');
const userB = await createTestUser('pin-b');

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
  // Lấy task thứ 10 (đủ xa để chắc chắn start tự tính > ngày bắt đầu plan, dù task đầu rất ngắn)
  const targetTask = before.schedule.tasks.filter((t) => t.status === 'todo')[9]!;
  const taskId = targetTask.id;
  if (new Date(targetTask.start!).getTime() <= new Date(before.plan.start_date).getTime()) {
    throw new Error('Giả định sai: task thứ 10 phải có start tự tính sau ngày bắt đầu plan để test conflict');
  }

  // Ghim đúng ngày bắt đầu plan (sớm hơn lịch tự tính của task #10) -> phải báo conflict (trùng task trước)
  const earlyDate = before.plan.start_date;
  const pinResult = await pinTaskInDb(userA.client, taskId, earlyDate);
  eq('Ghim sớm hơn lịch tự tính -> conflict=true', pinResult.conflict, true);
  const { data: rowAfterPin } = await userA.client.from('plan_task_state').select('pinned_start').eq('task_id', taskId).single();
  eq('DB lưu đúng ngày ghim', rowAfterPin?.pinned_start, earlyDate);

  // Ghim ngày Ở QUÁ KHỨ xa (trước today) -> phải bị pinClamped (đưa về ngày bắt đầu hiệu lực)
  const pastDate = '2000-01-01';
  const pinPastResult = await pinTaskInDb(userA.client, taskId, pastDate);
  eq('Ghim ngày quá khứ xa -> pinClamped=true', pinPastResult.pinClamped, true);
  const { data: rowAfterPastPin } = await userA.client.from('plan_task_state').select('pinned_start').eq('task_id', taskId).single();
  eq('DB vẫn lưu đúng ngày người dùng chọn (clamp chỉ ảnh hưởng lúc TÍNH lịch, không đổi dữ liệu đã lưu)', rowAfterPastPin?.pinned_start, pastDate);

  // Xóa ghim
  const unpinResult = await unpinTaskInDb(userA.client, taskId);
  eq('Xóa ghim: changed=true vì trước đó có ghim', unpinResult.changed, true);
  const { data: rowAfterUnpin } = await userA.client.from('plan_task_state').select('pinned_start').eq('task_id', taskId).single();
  eq('DB xóa sạch pinned_start', rowAfterUnpin?.pinned_start, null);

  // Xóa ghim lần nữa (đã null sẵn): changed=false, không lỗi
  const unpinAgain = await unpinTaskInDb(userA.client, taskId);
  eq('Xóa ghim khi đã không ghim: changed=false', unpinAgain.changed, false);

  // Task done: ghim/xóa ghim phải bị từ chối
  const { data: doneCandidate } = await userA.client.from('plan_task_state').select('task_id').neq('task_id', taskId).limit(1).maybeSingle();
  if (doneCandidate) {
    await userA.client.from('plan_task_state').update({ status: 'done' }).eq('task_id', doneCandidate.task_id);
    let threwPin = false;
    try {
      await pinTaskInDb(userA.client, doneCandidate.task_id, '2026-11-01');
    } catch {
      threwPin = true;
    }
    eq('Ghim task done phải bị từ chối', threwPin, true);
  }

  // B ghim cùng mã task: chỉ đổi plan của B, không đụng A
  const beforeA = await userA.client.from('plan_task_state').select('pinned_start').eq('task_id', taskId).single();
  await pinTaskInDb(userB.client, taskId, '2026-12-01');
  const afterA = await userA.client.from('plan_task_state').select('pinned_start').eq('task_id', taskId).single();
  eq('B ghim task trùng mã không ảnh hưởng A', afterA.data?.pinned_start, beforeA.data?.pinned_start);

  report();
} finally {
  await deleteTestUser(userA);
  await deleteTestUser(userB);
}
