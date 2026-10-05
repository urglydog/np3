import type { SupabaseClient } from '@supabase/supabase-js';
import {
  toTaskInputs,
  toResourceInputs,
  computeSchedule,
  needByDates,
  planPurchases,
  todayInTimeZone,
  type ResourceStatus,
  type PurchaseItem,
} from '@roadmap/core';
import { AppError } from './errors';

/**
 * Giống `schedule-mutations.ts`: chỉ nhận `SupabaseClient` có sẵn (không import `next/headers`),
 * để Server Action và script tích hợp gọi chung. Mọi tính toán "cần mua khi nào/hạn đặt" đều qua
 * @roadmap/core, không tự tính lại ở đây.
 */

interface ResourceContext {
  planId: string;
  resourceId: string;
  purchaseItem: PurchaseItem | null;
}

async function recomputePurchaseItem(supabase: SupabaseClient, planId: string, resourceId: string): Promise<ResourceContext> {
  const { data: plan } = await supabase
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .eq('id', planId)
    .single();
  if (!plan) throw new AppError('Bạn chưa có lộ trình', 'no_plan', 404);

  const { data: templateTasks } = await supabase
    .from('template_tasks')
    .select('id, est_hours, optional, sort')
    .eq('template_id', plan.template_id)
    .order('sort');
  const { data: planTaskStates } = await supabase.from('plan_task_state').select('task_id, status, pinned_start').eq('plan_id', plan.id);
  const { data: templateResources } = await supabase
    .from('template_resources')
    .select('id, title, tier, price_vnd, lead_time_days')
    .eq('template_id', plan.template_id);
  const { data: planResourceStates } = await supabase
    .from('plan_resource_state')
    .select('resource_id, status, opted_in, eta')
    .eq('plan_id', plan.id);
  const { data: taskResourceLinks } = await supabase
    .from('template_task_resources')
    .select('task_id, resource_id, template_tasks!inner(template_id)')
    .eq('template_tasks.template_id', plan.template_id);

  if (!templateTasks || !planTaskStates || !templateResources || !planResourceStates || !taskResourceLinks) {
    throw new AppError('Không đọc được dữ liệu lộ trình', 'read_failed', 500);
  }

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
  const purchaseItem = items.find((i) => i.resourceId === resourceId) ?? null;

  return { planId: plan.id, resourceId, purchaseItem };
}

async function requirePlan(supabase: SupabaseClient): Promise<{ id: string; timezone: string }> {
  const { data: plan } = await supabase.from('plans').select('id, timezone').limit(1).maybeSingle();
  if (!plan) throw new AppError('Bạn chưa có lộ trình', 'no_plan', 404);
  return plan;
}

export interface ResourceMutationResult {
  resourceId: string;
  status: ResourceStatus;
  purchaseItem: PurchaseItem | null;
}

export async function setResourceStatus(
  supabase: SupabaseClient,
  resourceId: string,
  targetStatus: ResourceStatus,
  eta: string | null
): Promise<ResourceMutationResult> {
  const plan = await requirePlan(supabase);
  const patch: { status: ResourceStatus; eta: string | null; ordered_on?: string | null } =
    targetStatus === 'ordered'
      ? { status: targetStatus, eta, ordered_on: todayInTimeZone(plan.timezone) }
      : { status: targetStatus, eta: null };
  const { error } = await supabase.from('plan_resource_state').update(patch).eq('plan_id', plan.id).eq('resource_id', resourceId);
  if (error) throw new AppError(error.message, 'update_failed', 400);

  const ctx = await recomputePurchaseItem(supabase, plan.id, resourceId);
  return { resourceId, status: targetStatus, purchaseItem: ctx.purchaseItem };
}

export async function updateResourceEta(supabase: SupabaseClient, resourceId: string, eta: string): Promise<ResourceMutationResult> {
  const plan = await requirePlan(supabase);
  const { error } = await supabase.from('plan_resource_state').update({ eta }).eq('plan_id', plan.id).eq('resource_id', resourceId);
  if (error) throw new AppError(error.message, 'update_failed', 400);

  const ctx = await recomputePurchaseItem(supabase, plan.id, resourceId);
  return { resourceId, status: 'ordered', purchaseItem: ctx.purchaseItem };
}

export async function setResourceOptedIn(supabase: SupabaseClient, resourceId: string, optedIn: boolean): Promise<ResourceMutationResult> {
  const plan = await requirePlan(supabase);
  const { error } = await supabase.from('plan_resource_state').update({ opted_in: optedIn }).eq('plan_id', plan.id).eq('resource_id', resourceId);
  if (error) throw new AppError(error.message, 'update_failed', 400);

  const { data: row } = await supabase.from('plan_resource_state').select('status').eq('plan_id', plan.id).eq('resource_id', resourceId).single();
  const ctx = await recomputePurchaseItem(supabase, plan.id, resourceId);
  return { resourceId, status: (row?.status as ResourceStatus) ?? 'none', purchaseItem: ctx.purchaseItem };
}
