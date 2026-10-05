import {
  toTaskInputs,
  toResourceInputs,
  computeSchedule,
  needByDates,
  planPurchases,
  monthlySpend,
  todayInTimeZone,
  type ResourceStatus,
} from '@roadmap/core';
import { createClient } from '@/lib/supabase/server';
import { buildPurchaseRows, type PurchaseRow } from '@/lib/buy';

export interface PurchaseData {
  planId: string;
  today: string;
  rows: PurchaseRow[];
  monthlySpend: Record<string, number>;
}

/** Đọc toàn bộ dữ liệu cần cho /buy và /upcoming (tài nguyên + trạng thái mua) của plan hiện tại. */
export async function loadPurchaseData(): Promise<PurchaseData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: plan } = await supabase
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .limit(1)
    .maybeSingle();
  if (!plan) return null;

  const { data: templateTasks } = await supabase
    .from('template_tasks')
    .select('id, est_hours, optional, sort')
    .eq('template_id', plan.template_id)
    .order('sort');
  const { data: planTaskStates } = await supabase.from('plan_task_state').select('task_id, status, pinned_start').eq('plan_id', plan.id);

  const { data: templateResources } = await supabase
    .from('template_resources')
    .select('id, code, title, tier, price_vnd, price_checked_at, free_alternative, buy_url, is_affiliate, lead_time_days')
    .eq('template_id', plan.template_id);
  const { data: planResourceStates } = await supabase
    .from('plan_resource_state')
    .select('resource_id, status, opted_in, ordered_on, eta')
    .eq('plan_id', plan.id);
  const { data: taskResourceLinks } = await supabase
    .from('template_task_resources')
    .select('task_id, resource_id, template_tasks!inner(template_id)')
    .eq('template_tasks.template_id', plan.template_id);

  if (!templateTasks || !planTaskStates || !templateResources || !planResourceStates || !taskResourceLinks) return null;

  const inputs = toTaskInputs(
    templateTasks.map((t) => ({ id: t.id, estHours: Number(t.est_hours), optional: t.optional, sort: t.sort })),
    planTaskStates.map((s) => ({ taskId: s.task_id, status: s.status, pinnedStart: s.pinned_start }))
  );
  const today = todayInTimeZone(plan.timezone);
  const schedule = computeSchedule(
    inputs,
    { startDate: plan.start_date, hoursPerDay: Number(plan.hours_per_day), daysPerWeek: plan.days_per_week },
    today
  );

  const resourceStateByResourceId = new Map(planResourceStates.map((s) => [s.resource_id, s]));
  const outline = templateResources.map((r) => {
    const state = resourceStateByResourceId.get(r.id);
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      tier: r.tier as 'core' | 'optional',
      priceVnd: Number(r.price_vnd),
      priceCheckedAt: r.price_checked_at,
      freeAlternative: r.free_alternative,
      buyUrl: r.buy_url,
      isAffiliate: r.is_affiliate,
      leadTimeDays: r.lead_time_days,
      status: state?.status ?? 'none',
      optedIn: state?.opted_in ?? r.tier === 'core',
      orderedOn: state?.ordered_on ?? null,
      eta: state?.eta ?? null,
    };
  });

  const resources = toResourceInputs(
    templateResources.map((r) => ({ id: r.id, title: r.title, tier: r.tier, priceVnd: Number(r.price_vnd), leadTimeDays: r.lead_time_days })),
    planResourceStates.map((s) => ({ resourceId: s.resource_id, status: s.status as ResourceStatus, optedIn: s.opted_in, eta: s.eta }))
  );

  const taskResources: Record<string, string[]> = {};
  for (const link of taskResourceLinks) {
    (taskResources[link.task_id] ??= []).push(link.resource_id);
  }

  const needBy = needByDates(schedule.tasks, taskResources);
  const items = planPurchases(resources, needBy, today);
  const rows = buildPurchaseRows(outline, items);
  const spend = monthlySpend(items, today);

  return { planId: plan.id, today, rows, monthlySpend: spend };
}
