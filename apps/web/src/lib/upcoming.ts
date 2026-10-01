import { toDayNumber, type ScheduledTask } from '@roadmap/core';
import type { PurchaseRow } from './buy';

export type UpcomingEntry =
  | { type: 'task'; date: string; id: string; title: string }
  | { type: 'purchase'; date: string; id: string; title: string; urgency: NonNullable<PurchaseRow['purchase']>['urgency'] };

/**
 * Gộp task có Start trong `horizonDays` ngày tới (từ @roadmap/core computeSchedule) với các mục cần
 * mua có hạn đặt (orderBy) trong cùng khoảng, hoặc đã quá hạn (overdue — vẫn cần thấy ngay). Sắp theo
 * ngày tăng dần. Ném lỗi nếu thiếu tên hiển thị cho 1 task đủ điều kiện — không hiện task "vô danh".
 */
export function buildUpcomingList(
  scheduleTasks: ScheduledTask[],
  taskNameById: Map<string, string>,
  purchaseRows: PurchaseRow[],
  today: string,
  horizonDays = 14
): UpcomingEntry[] {
  const todayN = toDayNumber(today);
  const horizonN = todayN + horizonDays;

  const taskEntries: UpcomingEntry[] = [];
  for (const t of scheduleTasks) {
    if (!t.start) continue; // done/skipped không chiếm lịch
    const startN = toDayNumber(t.start);
    if (startN < todayN || startN > horizonN) continue;
    const name = taskNameById.get(t.id);
    if (!name) throw new Error(`buildUpcomingList: thiếu tên hiển thị cho task ${t.id}`);
    taskEntries.push({ type: 'task', date: t.start, id: t.id, title: name });
  }

  const purchaseEntries: UpcomingEntry[] = [];
  for (const row of purchaseRows) {
    if (!row.purchase) continue;
    const orderByN = toDayNumber(row.purchase.orderBy);
    if (row.purchase.urgency !== 'overdue' && orderByN > horizonN) continue;
    purchaseEntries.push({ type: 'purchase', date: row.purchase.orderBy, id: row.id, title: row.title, urgency: row.purchase.urgency });
  }

  return [...taskEntries, ...purchaseEntries].sort((a, b) => a.date.localeCompare(b.date));
}
