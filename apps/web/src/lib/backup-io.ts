import { createClient } from '@/lib/supabase/server';
import { buildBackupPayload, type BackupPayload, type RawTaskRow, type RawResourceRow } from '@/lib/backup';

/** Đọc toàn bộ dữ liệu plan của user hiện tại và đóng gói đúng hình dạng bản sao lưu. Dùng cho GET /api/backup. */
export async function loadBackupExportData(): Promise<BackupPayload | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: plan } = await supabase
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, include_optional, timezone')
    .limit(1)
    .maybeSingle();
  if (!plan) return null;

  const { data: template } = await supabase.from('templates').select('slug, version').eq('id', plan.template_id).single();

  const { data: taskRows } = await supabase
    .from('plan_task_state')
    .select('status, writing_reps, kana_accuracy, speaking_minutes, pinned_start, done_on, template_tasks!inner(code, template_id)')
    .eq('plan_id', plan.id)
    .eq('template_tasks.template_id', plan.template_id);

  const { data: resourceRows } = await supabase
    .from('plan_resource_state')
    .select('status, opted_in, ordered_on, eta, template_resources!inner(code, template_id)')
    .eq('plan_id', plan.id)
    .eq('template_resources.template_id', plan.template_id);

  const tasks: RawTaskRow[] = (taskRows ?? []).map((r) => ({
    code: (r.template_tasks as unknown as { code: string }).code,
    status: r.status,
    writing_reps: r.writing_reps,
    kana_accuracy: r.kana_accuracy,
    speaking_minutes: r.speaking_minutes,
    pinned_start: r.pinned_start,
    done_on: r.done_on,
  }));
  const resources: RawResourceRow[] = (resourceRows ?? []).map((r) => ({
    code: (r.template_resources as unknown as { code: string }).code,
    status: r.status,
    opted_in: r.opted_in,
    ordered_on: r.ordered_on,
    eta: r.eta,
  }));

  return buildBackupPayload(
    template!.slug,
    template!.version,
    {
      startDate: plan.start_date,
      hoursPerDay: Number(plan.hours_per_day),
      daysPerWeek: plan.days_per_week,
      includeOptional: plan.include_optional,
      timezone: plan.timezone,
    },
    tasks,
    resources
  );
}
