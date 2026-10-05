import { z } from 'zod';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { 
  todayInTimeZone, toTaskInputs, computeSchedule, toResourceInputs, 
  needByDates, planPurchases, buildReminders, diffReminders,
  type ReminderPrefs
} from '@roadmap/core';

// ── Env validation ─────────────────────────────────────────────────────────
const envSchema = z.object({
  TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().default('mailto:dev@localhost'),
  // Chu kỳ vòng lặp worker (ms); mặc định 60 giây
  WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
});

const env = envSchema.parse(process.env);

// ── Supabase (service role — chỉ dùng ở server/worker) ────────────────────
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── VAPID setup ─────────────────────────────────────────────────────────────
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

// ── Xử lý hàng đợi reminders (outbox) ─────────────────────────────────────
async function processReminders(): Promise<void> {
  const now = new Date().toISOString();

  // Lấy tối đa 50 reminder cần gửi, dùng FOR UPDATE SKIP LOCKED thông qua RPC
  // Ở đây dùng select + update tuần tự vì Supabase JS SDK chưa hỗ trợ SKIP LOCKED trực tiếp.
  // Với quy mô 1 người dùng đây là an toàn; mở rộng sau → viết RPC.
  const { data: reminders, error: fetchError } = await supabase
    .from('reminders')
    .select('id, user_id, plan_id, title, body, deep_link, kind, dedupe_key')
    .eq('status', 'pending')
    .lte('fire_at', now)
    .order('fire_at', { ascending: true })
    .limit(50);

  if (fetchError) {
    console.error('[worker] Lỗi lấy reminders:', fetchError.message);
    return;
  }

  if (!reminders || reminders.length === 0) return;

  console.log(`[worker] Gửi ${reminders.length} reminder(s)…`);

  for (const reminder of reminders) {
    // Lấy tất cả subscription đang hoạt động của user
    const { data: subs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
      .eq('user_id', reminder.user_id)
      .is('disabled_at', null);

    if (subError) {
      console.error(`[worker] Lỗi lấy subscription cho user ${reminder.user_id}:`, subError.message);
      continue;
    }

    if (!subs || subs.length === 0) {
      // Không có subscription → đánh dấu cancelled
      await supabase
        .from('reminders')
        .update({ status: 'cancelled' })
        .eq('id', reminder.id);
      continue;
    }

    const payload = JSON.stringify({
      title: reminder.title,
      body: reminder.body,
      url: reminder.deep_link,
      tag: `${reminder.kind}-${reminder.dedupe_key}`,
    });

    let anySuccess = false;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
          { TTL: 3600 }
        );
        await supabase
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString() })
          .eq('id', sub.id);
        anySuccess = true;
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === 'object' && 'statusCode' in err
            ? (err as { statusCode: number }).statusCode
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          console.warn(`[worker] Subscription ${sub.id} hết hạn (${statusCode}), vô hiệu hóa.`);
          await supabase
            .from('push_subscriptions')
            .update({ disabled_at: new Date().toISOString() })
            .eq('id', sub.id);
        } else {
          console.error(`[worker] Lỗi gửi tới sub ${sub.id}:`, err);
        }
      }
    }

    // Cập nhật trạng thái reminder
    const newStatus = anySuccess ? 'sent' : 'failed';
    await supabase
      .from('reminders')
      .update({
        status: newStatus,
        attempts: 1,
        sent_at: anySuccess ? new Date().toISOString() : null,
      })
      .eq('id', reminder.id);

    if (anySuccess) {
      console.log(`[worker] ✓ Đã gửi reminder ${reminder.id} (${reminder.kind})`);
    } else {
      console.warn(`[worker] ✗ Không gửi được reminder ${reminder.id} — tất cả sub đều lỗi`);
    }
  }
}

// ── Sinh nhắc việc (T-010) ──────────────────────────────────────────────────
async function syncAllReminders(): Promise<void> {
  const { data: plans, error: planErr } = await supabase
    .from('plans')
    .select('id, user_id, template_id, start_date, hours_per_day, days_per_week, timezone, reminder_time, quiet_hours_start, quiet_hours_end, rest_days');
  
  if (planErr || !plans) {
    console.error('[worker] Lỗi lấy plans:', planErr?.message);
    return;
  }

  const now = new Date();

  for (const plan of plans) {
    // 1. Fetch template data
    const { data: templateTasks } = await supabase
      .from('template_tasks')
      .select('id, name, est_hours, optional, sort')
      .eq('template_id', plan.template_id)
      .order('sort');

    const { data: planTaskStates } = await supabase
      .from('plan_task_state')
      .select('task_id, status, pinned_start')
      .eq('plan_id', plan.id);

    const { data: templateResources } = await supabase
      .from('template_resources')
      .select('id, title, tier, price_vnd, lead_time_days')
      .eq('template_id', plan.template_id);

    const { data: resourceStates } = await supabase
      .from('plan_resource_state')
      .select('resource_id, status, opted_in, eta')
      .eq('plan_id', plan.id);

    const { data: taskResLinks } = await supabase
      .from('template_task_resources')
      .select('task_id, resource_id, template_tasks!inner(template_id)')
      .eq('template_tasks.template_id', plan.template_id);

    if (!templateTasks || !planTaskStates || !templateResources || !resourceStates || !taskResLinks) continue;

    // 2. Build Schedule
    const taskInputs = toTaskInputs(
      templateTasks.map(t => ({ id: t.id, estHours: Number(t.est_hours), optional: t.optional, sort: t.sort })),
      planTaskStates.map(s => ({ taskId: s.task_id, status: s.status as 'todo' | 'in_progress' | 'done' | 'skipped', pinnedStart: s.pinned_start }))
    );
    const today = todayInTimeZone(plan.timezone, now);
    const schedule = computeSchedule(
      taskInputs,
      { startDate: plan.start_date, hoursPerDay: Number(plan.hours_per_day), daysPerWeek: plan.days_per_week },
      today
    );

    // 3. Build Purchases
    const resources = toResourceInputs(
      templateResources.map(r => ({ id: r.id, title: r.title, tier: r.tier as 'core' | 'optional', priceVnd: r.price_vnd, leadTimeDays: r.lead_time_days })),
      resourceStates.map(s => ({ resourceId: s.resource_id, status: s.status as 'none' | 'owned' | 'ordered' | 'received' | 'not_needed', optedIn: s.opted_in, eta: s.eta }))
    );
    const taskResources: Record<string, string[]> = {};
    for (const l of taskResLinks) {
      (taskResources[l.task_id] ??= []).push(l.resource_id);
    }
    const needBy = needByDates(schedule.tasks, taskResources);
    const purchases = planPurchases(resources, needBy, today);

    const taskNames: Record<string, string> = {};
    for (const t of templateTasks) taskNames[t.id] = t.name;

    // 4. Draft Reminders
    const prefs: ReminderPrefs = {
      timezone: plan.timezone,
      studyTime: plan.reminder_time.substring(0, 5),
      buyTime: '09:00', // Hardcode cho buyTime hiện tại
      horizonDays: 14,
      restWeekdays: plan.rest_days,
      quietStart: plan.quiet_hours_start.substring(0, 5),
      quietEnd: plan.quiet_hours_end.substring(0, 5),
      notifyStudy: true, // Nếu user tắt thì sẽ không nhận được web push
      notifyBuy: true,
    };

    const drafts = buildReminders({
      schedule: schedule.tasks,
      taskNames,
      purchases,
      prefs,
      today,
      now
    });

    // 5. Diff & Upsert
    const { data: existing } = await supabase
      .from('reminders')
      .select('id, kind, dedupe_key, status, fire_at, title, body')
      .eq('plan_id', plan.id);

    if (!existing) continue;
    
    // Map existing records to the format expected by diffReminders
    const existingMapped = existing.map(e => ({
      kind: e.kind,
      dedupeKey: e.dedupe_key,
      status: e.status as 'pending' | 'sent' | 'failed' | 'cancelled',
      fireAt: e.fire_at,
      title: e.title,
      body: e.body,
      id: e.id,
    }));

    const { toInsert, toUpdate, toCancel } = diffReminders(existingMapped, drafts);

    for (const draft of toInsert) {
      await supabase.from('reminders').insert({
        user_id: plan.user_id,
        plan_id: plan.id,
        kind: draft.kind,
        dedupe_key: draft.dedupeKey,
        fire_at: draft.fireAt,
        title: draft.title,
        body: draft.body,
        deep_link: draft.deepLink
      });
    }

    for (const draft of toUpdate) {
      await supabase.from('reminders').update({
        fire_at: draft.fireAt,
        title: draft.title,
        body: draft.body,
        deep_link: draft.deepLink
      }).eq('plan_id', plan.id).eq('kind', draft.kind).eq('dedupe_key', draft.dedupeKey);
    }

    for (const ex of toCancel) {
      await supabase.from('reminders').update({ status: 'cancelled' }).eq('id', (ex as unknown as { id: string }).id);
    }
    
    if (toInsert.length || toUpdate.length || toCancel.length) {
      console.log(`[worker] Cập nhật ${toInsert.length} tạo mới, ${toUpdate.length} sửa, ${toCancel.length} huỷ cho user ${plan.user_id}`);
    }
  }
}

// ── Vòng lặp chính ──────────────────────────────────────────────────────────
let stopped = false;

function heartbeat(): void {
  if (stopped) return;
  const today = todayInTimeZone(env.TIMEZONE);
  console.log(`[worker] nhịp tim ${new Date().toISOString()} — hôm nay (${env.TIMEZONE}): ${today}`);
  
  // Chạy processReminders (gửi đi) và syncAllReminders (tạo mới)
  Promise.all([
    processReminders(),
    syncAllReminders()
  ]).catch((err: unknown) => {
    console.error('[worker] heartbeat lỗi không dự kiến:', err);
  });
}

heartbeat();
const interval = setInterval(heartbeat, env.WORKER_INTERVAL_MS);

function shutdown(signal: string): void {
  stopped = true;
  clearInterval(interval);
  console.log(`[worker] nhận ${signal}, tắt sạch.`);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
