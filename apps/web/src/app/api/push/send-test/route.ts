import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';

// Bí mật VAPID chỉ đọc ở server; không bao giờ NEXT_PUBLIC_
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:dev@localhost';

export async function POST() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: 'VAPID keys chưa được cấu hình. Thêm NEXT_PUBLIC_VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY vào .env.local.' },
      { status: 500 }
    );
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });

  // Lấy tất cả subscription của user này (chưa bị vô hiệu hóa)
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', user.id)
    .is('disabled_at', null);

  if (error) {
    console.error('[push/send-test]', error.message);
    return NextResponse.json({ error: 'Không thể lấy danh sách đăng ký.' }, { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'Chưa có đăng ký thông báo nào. Hãy bật thông báo trước.' }, { status: 404 });
  }

  const payload = JSON.stringify({
    title: '🎯 Roadmap Planner',
    body: 'Thông báo thử nghiệm — push notification đang hoạt động!',
    url: '/today',
    tag: 'test',
  });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          payload,
          { TTL: 60 }
        );
        // Cập nhật last_success_at
        await supabase
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === 'object' && 'statusCode' in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        // 404 / 410: subscription không còn hợp lệ → vô hiệu hóa
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .update({ disabled_at: new Date().toISOString() })
            .eq('id', sub.id);
          console.warn(`[push/send-test] Subscription ${sub.id} hết hạn (${statusCode}), đã vô hiệu hóa.`);
        } else {
          console.error(`[push/send-test] Lỗi gửi tới ${sub.id}:`, err);
        }
        throw err;
      }
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ ok: true, succeeded, failed });
}
