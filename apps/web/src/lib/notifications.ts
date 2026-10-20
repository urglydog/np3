import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { loadCurrentPlanSchedule } from '@/lib/plan';
import { loadPurchaseData } from '@/lib/resources';
import { buildUpcomingList } from '@/lib/upcoming';

export type NotificationKind = 'study_daily' | 'buy_book';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  deepLink: string;
  sentAt: string;
  kind: NotificationKind;
  lateRisk: boolean; // buy_book có nguy cơ giao trễ — tiêu đề sinh từ packages/core/reminders.ts
}

/** 20 thông báo đã gửi gần nhất của user hiện tại (dùng cho chuông thông báo). */
export async function loadRecentNotifications(): Promise<NotificationItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('reminders')
    .select('id, title, body, deep_link, sent_at, kind')
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
    kind: r.kind as NotificationKind,
    lateRisk: r.title.startsWith('Có thể giao trễ:'),
  }));
}

/**
 * Số mục thật sự "sắp tới" trong 3 ngày tới (task Start + mục cần mua tới hạn) — dùng cho badge trên
 * tab Sắp tới ở bottom nav. Dùng ĐÚNG cùng nguồn dữ liệu và hàm thuần (buildUpcomingList) với trang
 * /upcoming (chỉ thu hẹp horizon còn 3 ngày thay vì 30), không còn đếm nhầm bảng outbox `reminders`
 * (vốn không phản ánh đúng nội dung tab Sắp tới — xem phản hồi người dùng). Đánh đổi: thêm 2 query
 * (plan + mua sắm) vào layout dùng chung mọi trang, chấp nhận được vì cùng mức chi phí các trang
 * today/roadmap/buy đã tự tải riêng.
 */
export async function loadUpcomingBadgeCount(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;

  const [plan, purchaseData] = await Promise.all([loadCurrentPlanSchedule(), loadPurchaseData()]);
  if (!plan) return 0;

  const taskNameById = new Map([...plan.taskInfoById.entries()].map(([id, info]) => [id, info.name]));
  const list = buildUpcomingList(plan.schedule.tasks, taskNameById, purchaseData?.rows ?? [], plan.today, 3);
  return list.length;
}
