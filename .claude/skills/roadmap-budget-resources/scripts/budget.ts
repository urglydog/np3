/**
 * Lịch mua sách/công cụ: tính "ngày cần có" từ lịch học và "hạn đặt mua" từ thời gian giao hàng.
 * Hàm thuần, dùng chung giữa app và worker nhắc việc. Lịch đổi thì kết quả tự đổi theo (không lưu ngày nhập tay).
 */
import { fromDayNumber, toDayNumber, type ScheduledTask } from '../../roadmap-schedule-engine/scripts/schedule.ts';

export type ResourceStatus = 'none' | 'owned' | 'ordered' | 'received' | 'not_needed';
export interface ResourceInput {
  id: string;
  title: string;
  tier: 'core' | 'optional';
  priceVnd: number;
  leadTimeDays: number;
  status: ResourceStatus;
  optedIn: boolean;          // 'optional' mặc định false: không nhắc mua nếu người dùng chưa chọn dùng
  eta?: string | null;       // ngày dự kiến giao nếu đã đặt
}
export type Urgency = 'overdue' | 'due_soon' | 'upcoming' | 'later';
export interface PurchaseItem {
  resourceId: string;
  title: string;
  needBy: string;            // ngày bắt đầu của task đầu tiên (chưa xong) dùng tài nguyên này
  orderBy: string;           // needBy - thời gian giao - ngày đệm
  daysUntilOrderBy: number;  // âm nếu đã quá hạn đặt
  urgency: Urgency;
  action: 'order' | 'wait_delivery' | 'late_risk' | 'get_free';
  remind: boolean;           // có nên đẩy thông báo không (đồ miễn phí thì không)
  priceVnd: number;
}
export interface PurchaseOptions { bufferDays?: number; dueSoonDays?: number; horizonDays?: number }

/** Ngày cần có = Start sớm nhất trong các task chưa xong dùng tài nguyên đó. */
export function needByDates(schedule: ScheduledTask[], taskResources: Record<string, string[]>): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of schedule) {
    if (!t.start) continue; // done/skipped không chiếm lịch nên không tạo nhu cầu
    for (const rid of taskResources[t.id] ?? []) {
      const cur = m.get(rid);
      if (!cur || toDayNumber(t.start) < toDayNumber(cur)) m.set(rid, t.start);
    }
  }
  return m;
}

export function planPurchases(resources: ResourceInput[], needBy: Map<string, string>, today: string, opt: PurchaseOptions = {}): PurchaseItem[] {
  const buffer = opt.bufferDays ?? 3, dueSoon = opt.dueSoonDays ?? 7, horizon = opt.horizonDays ?? 30;
  const t0 = toDayNumber(today);
  const items: PurchaseItem[] = [];
  for (const r of resources) {
    if (r.status === 'owned' || r.status === 'received' || r.status === 'not_needed') continue;
    if (r.tier === 'optional' && !r.optedIn) continue;
    const nb = needBy.get(r.id);
    if (!nb) continue; // không task nào còn cần
    const free = r.priceVnd === 0;
    const orderByN = toDayNumber(nb) - (free ? 1 : r.leadTimeDays + buffer);
    const days = orderByN - t0;
    let action: PurchaseItem['action'] = free ? 'get_free' : 'order';
    if (r.status === 'ordered') {
      action = r.eta && toDayNumber(r.eta) > toDayNumber(nb) ? 'late_risk' : 'wait_delivery';
    }
    const urgency: Urgency = days < 0 ? 'overdue' : days <= dueSoon ? 'due_soon' : days <= horizon ? 'upcoming' : 'later';
    items.push({
      resourceId: r.id, title: r.title, needBy: nb, orderBy: fromDayNumber(orderByN), daysUntilOrderBy: days,
      urgency, action, remind: !free && (action === 'order' || action === 'late_risk'), priceVnd: r.priceVnd,
    });
  }
  return items.sort((a, b) => a.orderBy.localeCompare(b.orderBy));
}

/** Tổng chi dự kiến theo tháng (YYYY-MM của hạn đặt; mục quá hạn tính vào tháng hiện tại). Chỉ tính mục chưa đặt. */
export function monthlySpend(items: PurchaseItem[], today: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    if (it.action !== 'order') continue;
    const month = (it.urgency === 'overdue' ? today : it.orderBy).slice(0, 7);
    out[month] = (out[month] ?? 0) + it.priceVnd;
  }
  return out;
}
