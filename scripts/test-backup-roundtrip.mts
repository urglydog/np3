// Kiểm thử tích hợp vòng tròn: thao tác -> export -> xóa plan -> import -> export lại -> so khớp.
// Cần Supabase local đang chạy. KHÔNG db reset.
import { computeSchedule, toTaskInputs, todayInTimeZone } from '@roadmap/core';
import { createTestUser, createBasePlan, deleteTestUser, makeChecker } from './integration-helpers.mts';
import { buildBackupPayload, type BackupPayload } from '../apps/web/src/lib/backup.ts';
import { importBackupViaRpc } from '../apps/web/src/lib/backup-mutations.ts';
import { toggleTaskSkip, delayTaskInDb } from '../apps/web/src/lib/schedule-mutations.ts';
import { recordTracking } from '../apps/web/src/lib/tracking-mutations.ts';

const { eq, report } = makeChecker();
const userA = await createTestUser('backup-roundtrip');

async function exportPlan(client: typeof userA.client): Promise<BackupPayload> {
  const { data: plan } = await client
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, include_optional, timezone')
    .single();
  const { data: template } = await client.from('templates').select('slug, version').eq('id', plan.template_id).single();
  const { data: taskRows } = await client
    .from('plan_task_state')
    .select('status, writing_reps, kana_accuracy, speaking_minutes, pinned_start, done_on, template_tasks!inner(code, template_id)')
    .eq('plan_id', plan.id)
    .eq('template_tasks.template_id', plan.template_id);
  const { data: resRows } = await client
    .from('plan_resource_state')
    .select('status, opted_in, ordered_on, eta, template_resources!inner(code, template_id)')
    .eq('plan_id', plan.id)
    .eq('template_resources.template_id', plan.template_id);

  return buildBackupPayload(
    template.slug,
    template.version,
    {
      startDate: plan.start_date,
      hoursPerDay: Number(plan.hours_per_day),
      daysPerWeek: plan.days_per_week,
      includeOptional: plan.include_optional,
      timezone: plan.timezone,
    },
    taskRows.map((r) => ({
      code: r.template_tasks.code,
      status: r.status,
      writing_reps: r.writing_reps,
      kana_accuracy: r.kana_accuracy,
      speaking_minutes: r.speaking_minutes,
      pinned_start: r.pinned_start,
      done_on: r.done_on,
    })),
    resRows.map((r) => ({
      code: r.template_resources.code,
      status: r.status,
      opted_in: r.opted_in,
      ordered_on: r.ordered_on,
      eta: r.eta,
    }))
  );
}

async function scheduleFor(client: typeof userA.client) {
  const { data: plan } = await client
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .single();
  const { data: templateTasks } = await client.from('template_tasks').select('id, est_hours, optional, sort').eq('template_id', plan.template_id).order('sort');
  const { data: states } = await client.from('plan_task_state').select('task_id, status, pinned_start').eq('plan_id', plan.id);
  const inputs = toTaskInputs(
    templateTasks.map((t) => ({ id: t.id, estHours: Number(t.est_hours), optional: t.optional, sort: t.sort })),
    states.map((s) => ({ taskId: s.task_id, status: s.status, pinnedStart: s.pinned_start }))
  );
  const today = todayInTimeZone(plan.timezone);
  return computeSchedule(inputs, { startDate: plan.start_date, hoursPerDay: Number(plan.hours_per_day), daysPerWeek: plan.days_per_week }, today);
}

try {
  await createBasePlan(userA.client); // include_optional=false

  const { data: tasks } = await userA.client.from('template_tasks').select('id, code').order('sort').limit(5);
  const { data: res01 } = await userA.client.from('template_resources').select('id, code').eq('code', 'RES-01').single();

  // Thao tác đa dạng: done, skipped, hoãn, ghi nhận hằng ngày, trạng thái tài nguyên
  await userA.client.from('plan_task_state').update({ status: 'done', done_on: '2026-10-01' }).eq('task_id', tasks[0].id);
  await toggleTaskSkip(userA.client, tasks[1].id); // -> skipped
  await delayTaskInDb(userA.client, tasks[2].id, 3);
  await recordTracking(userA.client, tasks[3].id, 77, 0.88, 12);
  // resource-mutations.ts (T-007) chưa có trên nhánh này -> cập nhật trực tiếp qua Supabase client
  // (vẫn kiểm được đúng việc round-trip export/import của trạng thái tài nguyên).
  await userA.client.from('plan_resource_state').update({ status: 'ordered', eta: '2026-11-15' }).eq('resource_id', res01.id);

  const exportBefore = await exportPlan(userA.client);
  const scheduleBefore = await scheduleFor(userA.client);

  // Xóa plan của user test rồi import lại chính bản export vừa lấy
  await userA.client.from('plans').delete().eq('id', (await userA.client.from('plans').select('id').single()).data.id);
  const eqCountBeforeImport = (await userA.client.from('plans').select('id', { count: 'exact', head: true })).count;
  eq('Plan đã bị xóa trước khi import', eqCountBeforeImport, 0);

  await importBackupViaRpc(userA.client, exportBefore);

  const exportAfter = await exportPlan(userA.client);
  const scheduleAfter = await scheduleFor(userA.client);

  eq('Export trước và sau import giống nhau từng trường (JSON)', JSON.stringify(exportAfter), JSON.stringify(exportBefore));
  eq('computeSchedule cho cùng kết quả (finish)', scheduleAfter.finish, scheduleBefore.finish);
  eq('computeSchedule cho cùng kết quả (remainingHours)', scheduleAfter.remainingHours, scheduleBefore.remainingHours);
  eq(
    'computeSchedule cho cùng kết quả (từng task)',
    JSON.stringify(scheduleAfter.tasks),
    JSON.stringify(scheduleBefore.tasks)
  );

  report();
} finally {
  await deleteTestUser(userA);
}
