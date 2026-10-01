// Kiểm tra buildUpcomingList: gộp task có Start trong N ngày tới + mục cần mua trong cùng khoảng.
import { buildUpcomingList } from '../src/lib/upcoming';
import type { PurchaseRow } from '../src/lib/buy';
import type { ScheduledTask, PurchaseItem } from '@roadmap/core';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

const T = (id: string, start: string | null, status: ScheduledTask['status'] = 'todo'): ScheduledTask => ({
  id,
  status,
  start,
  due: start,
  cumHours: 1,
  conflict: false,
  pinClamped: false,
});

const PR = (id: string, purchase: Partial<PurchaseItem> | null): PurchaseRow => ({
  id,
  code: id,
  title: `Sách ${id}`,
  tier: 'core',
  priceVnd: 100000,
  priceCheckedAt: null,
  freeAlternative: null,
  buyUrl: null,
  isAffiliate: false,
  leadTimeDays: 5,
  status: 'none',
  optedIn: true,
  orderedOn: null,
  eta: null,
  purchase: purchase
    ? {
        resourceId: id,
        title: `Sách ${id}`,
        needBy: '2026-10-20',
        orderBy: '2026-10-10',
        daysUntilOrderBy: 5,
        urgency: 'upcoming',
        action: 'order',
        remind: true,
        priceVnd: 100000,
        ...purchase,
      }
    : null,
});

const today = '2026-10-01';
const names = new Map([
  ['A', 'Task A (hôm nay)'],
  ['B', 'Task B (trong 14 ngày)'],
  ['C', 'Task C (ngoài 14 ngày)'],
]);

// (a) task trong khoảng [today, today+14] được lấy, ngoài khoảng bị loại; done/skipped không chiếm lịch nên bị loại
{
  const tasks = [T('A', '2026-10-01'), T('B', '2026-10-10'), T('C', '2026-10-20'), T('D', null, 'done')];
  const list = buildUpcomingList(tasks, names, [], today);
  eq('(a) chỉ lấy A và B (trong 14 ngày)', list.map((e) => e.id), ['A', 'B']);
}

// (b) mục cần mua trong khoảng được lấy, ngoài khoảng (later) bị loại, overdue luôn được lấy dù quá hạn lâu
{
  const rows = [
    PR('R1', { orderBy: '2026-10-05', urgency: 'due_soon' }),
    PR('R2', { orderBy: '2026-11-01', urgency: 'later' }),
    PR('R3', { orderBy: '2026-01-01', urgency: 'overdue' }),
    PR('R4', null), // không có nhu cầu -> không xuất hiện
  ];
  const list = buildUpcomingList([], names, rows, today);
  eq('(b) lấy R1 (trong hạn) và R3 (overdue), loại R2 (later) và R4 (không nhu cầu)', list.map((e) => e.id).sort(), ['R1', 'R3']);
}

// (c) gộp cả task và purchase, sắp theo ngày tăng dần
{
  const tasks = [T('B', '2026-10-10')];
  const rows = [PR('R1', { orderBy: '2026-10-05', urgency: 'due_soon' })];
  const list = buildUpcomingList(tasks, names, rows, today);
  eq('(c) sắp theo ngày: R1 (10-05) trước B (10-10)', list.map((e) => e.id), ['R1', 'B']);
}

// (d) task đủ điều kiện nhưng thiếu tên hiển thị -> phải ném lỗi, không hiện "vô danh"
{
  let threw = false;
  try {
    buildUpcomingList([T('X', '2026-10-05')], names, [], today);
  } catch {
    threw = true;
  }
  eq('(d) thiếu tên hiển thị phải ném lỗi', threw, true);
}

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
