import { createClient, getCurrentUser } from '@/lib/supabase/server';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  deepLink: string;
  sentAt: string;
}

/** 20 thông báo đã gửi gần nhất của user hiện tại (dùng cho chuông thông báo). */
export async function loadRecentNotifications(): Promise<NotificationItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('reminders')
    .select('id, title, body, deep_link, sent_at')
    .eq('user_id', user.id)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(20);

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    deepLink: r.deep_link,
    sentAt: r.sent_at as string,
  }));
}

/**
 * Đếm nhẹ số reminder sắp tới (còn pending, trong 3 ngày tới) — dùng cho badge trên tab Sắp tới
 * ở bottom nav. Chỉ 1 query count, không load lại toàn bộ lịch/mua sắm (tránh chậm ở layout dùng
 * chung mọi trang).
 */
export async function loadUpcomingBadgeCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;

  const supabase = await createClient();
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('reminders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .lte('fire_at', in3Days);

  return count ?? 0;
}
