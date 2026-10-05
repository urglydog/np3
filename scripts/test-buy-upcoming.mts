// Kiểm thử tích hợp: /buy và /upcoming (T-007). Cần Supabase local đang chạy. KHÔNG db reset.
import { toTaskInputs, toResourceInputs, computeSchedule, needByDates, planPurchases, todayInTimeZone } from '@roadmap/core';
import { createTestUser, createBasePlan, deleteTestUser, makeChecker } from './integration-helpers.mts';
import { setResourceStatus, setResourceOptedIn } from '../apps/web/src/lib/resource-mutations.ts';
import { delayTaskInDb } from '../apps/web/src/lib/schedule-mutations.ts';

const { eq, report } = makeChecker();
const userA = await createTestUser('buy-a');
const userB = await createTestUser('buy-b');

async function readAll(client: typeof userA.client) {
  const { data: plan } = await client
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .limit(1)
    .single();
  const { data: templateTasks } = await client
    .from('template_tasks')
    .select('id, code, est_hours, optional, sort')
    .eq('template_id', plan!.template_id)
    .order('sort');
  const { data: states } = await client.from('plan_task_state').select('task_id, status, pinned_start').eq('plan_id', plan!.id);
  const { data: templateResources } = await client
    .from('template_resources')
    .select('id, code, tier, price_vnd, lead_time_days')
    .eq('template_id', plan!.template_id);
  const { data: resourceStates } = await client.from('plan_resource_state').select('resource_id, status, opted_in, eta').eq('plan_id', plan!.id);
  const { data: links } = await client
    .from('template_task_resources')
    .select('task_id, resource_id, template_tasks!inner(template_id)')
    .eq('template_tasks.template_id', plan!.template_id);

  const inputs = toTaskInputs(
    templateTasks!.map((t) => ({ id: t.id, estHours: Number(t.est_hours), optional: t.optional, sort: t.sort })),
    states!.map((s) => ({ taskId: s.task_id, status: s.status, pinnedStart: s.pinned_start }))
  );
  const today = todayInTimeZone(plan!.timezone);
  const settings = { startDate: plan!.start_date, hoursPerDay: Number(plan!.hours_per_day), daysPerWeek: plan!.days_per_week };
  const schedule = computeSchedule(inputs, settings, today);

  const resources = toResourceInputs(
    templateResources!.map((r) => ({ id: r.id, title: r.code, tier: r.tier, priceVnd: Number(r.price_vnd), leadTimeDays: r.lead_time_days })),
    resourceStates!.map((s) => ({ resourceId: s.resource_id, status: s.status, optedIn: s.opted_in, eta: s.eta }))
  );
  const taskResources: Record<string, string[]> = {};
  for (const l of links!) (taskResources[l.task_id] ??= []).push(l.resource_id);

  const needBy = needByDates(schedule.tasks, taskResources);
  const items = planPurchases(resources, needBy, today);

  return { plan: plan!, templateTasks: templateTasks!, templateResources: templateResources!, schedule, items, today };
}

try {
  await createBasePlan(userA.client); // include_optional=false
  await createBasePlan(userB.client);

  const before = await readAll(userA.client);
  const res01 = before.templateResources.find((r) => r.code === 'RES-01')!;
  const resOptional = before.templateResources.find((r) => r.tier === 'optional')!;
  const itemBefore = before.items.find((i) => i.resourceId === res01.id);
  if (!itemBefore) throw new Error('RES-01 phải có nhu cầu (needBy) ngay từ đầu để test');

  // A đánh dấu RES-01 "Đã đặt" với eta TRỄ hơn needBy -> action phải là late_risk
  const lateEta = '2099-01-01';
  const r1 = await setResourceStatus(userA.client, res01.id, 'ordered', lateEta);
  eq('Đặt với eta trễ hơn needBy -> late_risk', r1.purchaseItem?.action, 'late_risk');
  const { data: row1 } = await userA.client.from('plan_resource_state').select('status, eta').eq('resource_id', res01.id).single();
  eq('DB lưu đúng status=ordered', row1?.status, 'ordered');
  eq('DB lưu đúng eta', row1?.eta, lateEta);

  // Hoãn task đầu tiên dùng RES-01 (PH1-H01) 10 ngày -> needBy/orderBy của RES-01 phải dời theo
  const ph1h01 = before.templateTasks.find((t) => t.code === 'PH1-H01')!;
  await delayTaskInDb(userA.client, ph1h01.id, 10);
  const after = await readAll(userA.client);
  const itemAfter = after.items.find((i) => i.resourceId === res01.id);
  if (!itemAfter) throw new Error('RES-01 vẫn phải còn nhu cầu sau khi hoãn task');
  eq('needBy dời đúng +10 ngày sau khi hoãn task dùng RES-01', itemAfter.needBy, addDays(itemBefore.needBy, 10));
  eq('orderBy dời theo đúng (vì ordered nên bufferDays/leadTime không áp dụng thêm)', itemAfter.orderBy, addDays(itemBefore.orderBy, 10));

  // Tài nguyên optional chưa opted_in (vì include_optional=false lúc tạo plan) -> không có nhu cầu
  const optBefore = after.items.find((i) => i.resourceId === resOptional.id);
  eq('Optional chưa opted_in -> không xuất hiện trong planPurchases', optBefore, undefined);

  // Bật "Tôi muốn dùng" cho optional -> phải xuất hiện nhu cầu (nếu có task nào dùng tới)
  await setResourceOptedIn(userA.client, resOptional.id, true);
  const afterOptIn = await readAll(userA.client);
  const optAfter = afterOptIn.items.find((i) => i.resourceId === resOptional.id);
  // RES-09 (Pingo AI) có thể không gắn với task nào -> needBy rỗng là hợp lệ, chỉ cần optedIn được lưu đúng
  const { data: optRow } = await userA.client.from('plan_resource_state').select('opted_in').eq('resource_id', resOptional.id).single();
  eq('DB lưu đúng opted_in=true', optRow?.opted_in, true);
  void optAfter; // không ép buộc phải có needBy (tùy liên kết task thật trong template)

  // B thao tác trùng mã resource: chỉ ảnh hưởng plan của B, không đụng A
  const beforeA = await userA.client.from('plan_resource_state').select('status, eta').eq('resource_id', res01.id).single();
  await setResourceStatus(userB.client, res01.id, 'owned', null);
  const afterA = await userA.client.from('plan_resource_state').select('status, eta').eq('resource_id', res01.id).single();
  eq('B thao tác trùng mã resource không ảnh hưởng A', afterA.data, beforeA.data);

  report();
} finally {
  await deleteTestUser(userA);
  await deleteTestUser(userB);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
