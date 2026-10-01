// Chạy: npx tsx run-tests.mts
import { computeSchedule, type TaskInput } from '../src/schedule';
import { monthlySpend, needByDates, planPurchases, type ResourceInput } from '../src/budget';
let fails = 0, checks = 0;
const eq = (l: string, g: unknown, w: unknown) => { checks++; if (JSON.stringify(g) !== JSON.stringify(w)) { fails++; console.error(`FAIL ${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } };

// 2 giờ/ngày x 7 ngày/tuần. A=4h (10-01..10-02), B=6h (10-03..10-05), C=2h (10-06)
const S = { startDate: '2026-10-01', hoursPerDay: 2, daysPerWeek: 7 };
const tasks: TaskInput[] = [{ id: 'A', estHours: 4, status: 'todo' }, { id: 'B', estHours: 6, status: 'todo' }, { id: 'C', estHours: 2, status: 'todo' }];
const uses = { A: ['book1'], B: ['book2', 'pingo'], C: ['book2'] };
const R = (id: string, o: Partial<ResourceInput> = {}): ResourceInput =>
  ({ id, title: id, tier: 'core', priceVnd: 100000, leadTimeDays: 5, status: 'none', optedIn: true, ...o });
const today = '2026-09-20';
let sched = computeSchedule(tasks, S, today).tasks;
let nb = needByDates(sched, uses);
eq('needBy book1', nb.get('book1'), '2026-10-01');
eq('needBy book2 = task đầu tiên dùng nó', nb.get('book2'), '2026-10-03');

const res = [R('book1'), R('book2', { priceVnd: 200000 }), R('pingo', { tier: 'optional', optedIn: false, priceVnd: 1588000 })];
let items = planPurchases(res, nb, today);
eq('optional chưa chọn thì không nhắc', items.map((i) => i.resourceId), ['book1', 'book2']);
// book1: cần 10-01, giao 5 ngày + đệm 3 => hạn đặt 09-23 (cách hôm nay 3 ngày) => due_soon
eq('book1', [items[0].orderBy, items[0].daysUntilOrderBy, items[0].urgency, items[0].action], ['2026-09-23', 3, 'due_soon', 'order']);
eq('book2', [items[1].orderBy, items[1].urgency], ['2026-09-25', 'due_soon']); // cần 10-03 trừ 8 ngày

// Người dùng chọn dùng Pingo (đồ trả phí)
items = planPurchases([...res.slice(0, 2), { ...res[2], optedIn: true, leadTimeDays: 0 }], nb, today);
eq('pingo hạn đặt', items.find((i) => i.resourceId === 'pingo')!.orderBy, '2026-09-30');

// Hôm nay 09-28: cả hai đều đã qua hạn đặt (09-23 và 09-25)
items = planPurchases(res.slice(0, 2), nb, '2026-09-28');
eq('overdue', items.map((i) => i.urgency), ['overdue', 'overdue']);

// Đã đặt: không nhắc đặt nữa; nếu ETA sau ngày cần thì cảnh báo
items = planPurchases([R('book1', { status: 'ordered', eta: '2026-10-04' })], nb, today);
eq('late_risk', [items[0].action, items[0].remind], ['late_risk', true]);
items = planPurchases([R('book1', { status: 'ordered', eta: '2026-09-29' })], nb, today);
eq('wait_delivery', [items[0].action, items[0].remind], ['wait_delivery', false]);
// Đã có / đã nhận / không cần => không xuất hiện
eq('owned/received/not_needed', planPurchases([R('book1', { status: 'owned' }), R('book2', { status: 'received' })], nb, today).length, 0);
// Đồ miễn phí: không đẩy thông báo
items = planPurchases([R('book1', { priceVnd: 0, leadTimeDays: 0 })], nb, today);
eq('free', [items[0].action, items[0].remind], ['get_free', false]);
// Lịch đổi thì ngày cần có đổi theo: A done => book1 không còn nhu cầu; book2 bắt đầu sớm hơn
sched = computeSchedule([{ ...tasks[0], status: 'done' }, tasks[1], tasks[2]], S, today).tasks;
nb = needByDates(sched, uses);
eq('A done', [nb.has('book1'), nb.get('book2')], [false, '2026-10-01']);
// Tổng chi theo tháng
nb = needByDates(computeSchedule(tasks, S, today).tasks, uses);
items = planPurchases(res.slice(0, 2), nb, today);
eq('monthlySpend', monthlySpend(items, today), { '2026-09': 300000 });
console.log(`${checks - fails}/${checks} kiểm tra đạt`); process.exit(fails ? 1 : 0);
