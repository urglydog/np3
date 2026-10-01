// Chạy: npx tsx run-tests.mts
import { computeSchedule, type TaskInput } from '../src/schedule';
import { needByDates, planPurchases } from '../src/budget';
import { DEFAULT_PREFS, applyQuietHours, buildReminders, diffReminders, zonedTimeToUtc, type ExistingReminder } from '../src/reminders';
let fails = 0, checks = 0;
const eq = (l: string, g: unknown, w: unknown) => { checks++; if (JSON.stringify(g) !== JSON.stringify(w)) { fails++; console.error(`FAIL ${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } };

// Múi giờ
eq('VN 20:00', zonedTimeToUtc('2026-10-01', '20:00', 'Asia/Ho_Chi_Minh').toISOString(), '2026-10-01T13:00:00.000Z');
eq('NY mùa đông (UTC-5)', zonedTimeToUtc('2026-01-15', '12:00', 'America/New_York').toISOString(), '2026-01-15T17:00:00.000Z');
eq('NY mùa hè (UTC-4)', zonedTimeToUtc('2026-07-15', '12:00', 'America/New_York').toISOString(), '2026-07-15T16:00:00.000Z');
eq('NY ngày đổi giờ 2026-03-08', zonedTimeToUtc('2026-03-08', '12:00', 'America/New_York').toISOString(), '2026-03-08T16:00:00.000Z');
eq('Thứ trong tuần: 2026-10-01 là Thứ năm', new Date('2026-10-01T00:00:00Z').getUTCDay(), 4);

// Giờ yên tĩnh 22:00-07:00
const q = { ...DEFAULT_PREFS };
eq('quiet 22:30 -> 07:00 hôm sau', applyQuietHours(zonedTimeToUtc('2026-10-01', '22:30', q.timezone), q).toISOString(), '2026-10-02T00:00:00.000Z');
eq('quiet 03:00 -> 07:00 cùng ngày', applyQuietHours(zonedTimeToUtc('2026-10-01', '03:00', q.timezone), q).toISOString(), '2026-10-01T00:00:00.000Z');
eq('ngoài khung giữ nguyên', applyQuietHours(zonedTimeToUtc('2026-10-01', '20:00', q.timezone), q).toISOString(), '2026-10-01T13:00:00.000Z');

// Nhắc học + mua sách. 2h/ngày x 7: A 10-01..10-02, B 10-03..10-05, C 10-06
const S = { startDate: '2026-10-01', hoursPerDay: 2, daysPerWeek: 7 };
const tasks: TaskInput[] = [{ id: 'A', estHours: 4, status: 'todo' }, { id: 'B', estHours: 6, status: 'todo' }, { id: 'C', estHours: 2, status: 'todo' }];
const names = { A: 'Task A', B: 'Task B', C: 'Task C' };
const uses = { A: ['book1'], B: ['book2'], C: ['book2'] };
const today = '2026-09-20', now = new Date('2026-09-20T01:00:00Z');
const sched = computeSchedule(tasks, S, today).tasks;
const res = [{ id: 'book1', title: 'Sách 1', tier: 'core' as const, priceVnd: 100000, leadTimeDays: 5, status: 'none' as const, optedIn: true },
             { id: 'book2', title: 'Sách 2', tier: 'core' as const, priceVnd: 200000, leadTimeDays: 5, status: 'none' as const, optedIn: true }];
const purchases = planPurchases(res, needByDates(sched, uses), today);
let rem = buildReminders({ schedule: sched, taskNames: names, purchases, prefs: DEFAULT_PREFS, today, now });
const study = rem.filter((r) => r.kind === 'study_daily'), buy = rem.filter((r) => r.kind === 'buy_book');
eq('horizon 14 ngày từ 09-20 => đến 10-03: có 3 ngày học (10-01..10-03)', study.map((s) => s.dedupeKey), ['study:2026-10-01', 'study:2026-10-02', 'study:2026-10-03']);
eq('giờ nhắc học 20:00 VN', study[0].fireAt, '2026-10-01T13:00:00.000Z');
eq('tiêu đề', study[0].title, 'Hôm nay học: Task A');
eq('nhắc mua: hạn đặt 09-23 và 09-25, 09:00 VN', buy.map((b) => [b.dedupeKey, b.fireAt]), [['buy:book1:2026-09-23', '2026-09-23T02:00:00.000Z'], ['buy:book2:2026-09-25', '2026-09-25T02:00:00.000Z']]);
eq('sắp xếp theo giờ gửi', rem.map((r) => r.fireAt), [...rem.map((r) => r.fireAt)].sort());

// Ngày nghỉ cố định (Thứ năm = 4) bỏ nhắc học 10-01
rem = buildReminders({ schedule: sched, taskNames: names, purchases: [], prefs: { ...DEFAULT_PREFS, restWeekdays: [4] }, today, now });
eq('rest weekday', rem.map((r) => r.dedupeKey), ['study:2026-10-02', 'study:2026-10-03']);
// Giờ nhắc đã qua thì bỏ
rem = buildReminders({ schedule: sched, taskNames: names, purchases: [], prefs: DEFAULT_PREFS, today: '2026-10-01', now: new Date('2026-10-01T14:00:00Z') });
eq('đã qua 20:00 VN hôm nay', rem[0].dedupeKey, 'study:2026-10-02');
// Mua quá hạn: nhắc ngay hôm nay nếu còn giờ, nếu không thì ngày mai
const late = planPurchases(res.slice(0, 1), needByDates(sched, uses), '2026-09-28');
rem = buildReminders({ schedule: sched, taskNames: names, purchases: late, prefs: { ...DEFAULT_PREFS, notifyStudy: false }, today: '2026-09-28', now: new Date('2026-09-28T00:30:00Z') });
eq('overdue còn giờ', rem[0].fireAt, '2026-09-28T02:00:00.000Z');
rem = buildReminders({ schedule: sched, taskNames: names, purchases: late, prefs: { ...DEFAULT_PREFS, notifyStudy: false }, today: '2026-09-28', now: new Date('2026-09-28T05:00:00Z') });
eq('overdue đã qua giờ', rem[0].fireAt, '2026-09-29T02:00:00.000Z');
// Tắt nhắc
eq('tắt tất cả', buildReminders({ schedule: sched, taskNames: names, purchases, prefs: { ...DEFAULT_PREFS, notifyStudy: false, notifyBuy: false }, today, now }).length, 0);

// Đồng bộ với bảng reminders: hoãn B => ngày nhắc đổi; mục đã gửi không bị đụng
const v1 = buildReminders({ schedule: sched, taskNames: names, purchases, prefs: DEFAULT_PREFS, today, now });
const existing: ExistingReminder[] = v1.map((d) => ({ ...d, status: 'pending' }));
existing[0] = { ...existing[0]!, status: 'sent' };
const same = diffReminders(existing, v1);
eq('không đổi gì => không làm gì', [same.toInsert.length, same.toUpdate.length, same.toCancel.length], [0, 0, 0]);
const shifted = computeSchedule([tasks[0], { ...tasks[1], pinnedStart: '2026-10-10' }, tasks[2]], S, today).tasks;
const v2 = buildReminders({ schedule: shifted, taskNames: names, purchases: planPurchases(res, needByDates(shifted, uses), today), prefs: DEFAULT_PREFS, today, now });
const d = diffReminders(existing, v2);
eq('sau khi hoãn: huỷ nhắc cũ chưa gửi', d.toCancel.map((x) => x.dedupeKey).includes('buy:book2:2026-09-25'), true);
eq('sau khi hoãn: thêm nhắc mới', d.toInsert.map((x) => x.dedupeKey).includes('buy:book2:2026-10-02'), true);
eq('mục đã gửi không bị huỷ', d.toCancel.some((x) => x.status === 'sent'), false);
for (const [l, f] of [['giờ sai', () => zonedTimeToUtc('2026-10-01', '25:00', 'Asia/Ho_Chi_Minh')]] as const) { checks++; try { f(); fails++; console.error('FAIL phải ném lỗi: ' + l); } catch { /* đúng */ } }
console.log(`${checks - fails}/${checks} kiểm tra đạt`); process.exit(fails ? 1 : 0);
