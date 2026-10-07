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
