import { z } from 'zod';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { todayInTimeZone } from '@roadmap/core';

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

// ── Vòng lặp chính ──────────────────────────────────────────────────────────
let stopped = false;

function heartbeat(): void {
  if (stopped) return;
  const today = todayInTimeZone(env.TIMEZONE);
  console.log(`[worker] nhịp tim ${new Date().toISOString()} — hôm nay (${env.TIMEZONE}): ${today}`);
  processReminders().catch((err: unknown) => {
    console.error('[worker] processReminders lỗi không dự kiến:', err);
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
