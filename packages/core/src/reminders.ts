/**
 * Tạo nhắc việc (hàm thuần) từ lịch học + lịch mua sách. KHÔNG gửi gì cả.
 * Worker đọc kết quả, upsert vào bảng `reminders` (outbox) và gửi khi đến giờ.
 * Mọi mốc giờ tính theo múi giờ của người dùng rồi đổi sang UTC, vì "20:00" luôn nghĩa là 20:00 ở chỗ họ.
 */
import { fromDayNumber, toDayNumber, type ScheduledTask } from './schedule';
import type { PurchaseItem } from './budget';

export interface ReminderPrefs {
  timezone: string;        // vd 'Asia/Ho_Chi_Minh'
  studyTime: string;       // 'HH:MM' giờ địa phương
  buyTime: string;
  horizonDays: number;     // chỉ tạo nhắc cho N ngày tới (đồng thời tránh dồn quá nhiều thông báo hẹn giờ)
  restWeekdays: number[];  // 0 = Chủ nhật ... 6 = Thứ bảy; bỏ nhắc học vào các ngày này
  quietStart: string;      // khung giờ yên tĩnh, có thể qua nửa đêm
  quietEnd: string;
  notifyStudy: boolean;
  notifyBuy: boolean;
}
export const DEFAULT_PREFS: ReminderPrefs = {
  timezone: 'Asia/Ho_Chi_Minh', studyTime: '20:00', buyTime: '09:00', horizonDays: 14, restWeekdays: [],
  quietStart: '22:00', quietEnd: '07:00', notifyStudy: true, notifyBuy: true,
};
export interface ReminderDraft {
  kind: 'study_daily' | 'buy_book';
  dedupeKey: string;
  fireAt: string; // ISO UTC
  title: string;
  body: string;
  deepLink: string;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutes = (hhmm: string) => { const m = HHMM.exec(hhmm); if (!m) throw new Error(`Giờ không hợp lệ: ${hhmm}`); return +m[1] * 60 + +m[2]; };

function parts(utcMs: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(Math.floor(utcMs / 1000) * 1000));
  const g = (t: string) => +f.find((p) => p.type === t)!.value;
  return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute'), s: g('second') };
}
const offsetMs = (utcMs: number, tz: string) => { const p = parts(utcMs, tz); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(utcMs / 1000) * 1000; };

/** 'YYYY-MM-DD' + 'HH:MM' theo múi giờ tz  ->  thời điểm UTC. Xử lý đúng cả khi múi giờ có giờ mùa hè. */
export function zonedTimeToUtc(day: string, hhmm: string, tz: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const mins = minutes(hhmm);
  const guess = Date.UTC(y, m - 1, d, Math.floor(mins / 60), mins % 60);
  let utc = guess - offsetMs(guess, tz);
  utc = guess - offsetMs(utc, tz); // hiệu chỉnh lần hai quanh thời điểm đổi giờ
  return new Date(utc);
}
export function localDayAndMinutes(date: Date, tz: string): { day: string; minutes: number } {
  const p = parts(date.getTime(), tz);
  const day = `${String(p.y).padStart(4, '0')}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  return { day, minutes: p.h * 60 + p.mi };
}
/** Nếu giờ gửi rơi vào khung yên tĩnh thì dời đến lúc hết yên tĩnh. */
export function applyQuietHours(fire: Date, prefs: ReminderPrefs): Date {
  const qs = minutes(prefs.quietStart), qe = minutes(prefs.quietEnd);
  if (qs === qe) return fire;
  const { day, minutes: m } = localDayAndMinutes(fire, prefs.timezone);
  const crosses = qs > qe;
  const inQuiet = crosses ? m >= qs || m < qe : m >= qs && m < qe;
  if (!inQuiet) return fire;
  const target = crosses && m >= qs ? fromDayNumber(toDayNumber(day) + 1) : day;
  return zonedTimeToUtc(target, prefs.quietEnd, prefs.timezone);
}

export interface BuildInput {
  schedule: ScheduledTask[];
  taskNames: Record<string, string>;
  purchases: PurchaseItem[];
  prefs: ReminderPrefs;
  today: string;   // ngày hôm nay theo múi giờ người dùng
  now: Date;
}
export function buildReminders(inp: BuildInput): ReminderDraft[] {
  const { schedule, taskNames, purchases, prefs, today, now } = inp;
  const out: ReminderDraft[] = [];
  const t0 = toDayNumber(today);

  if (prefs.notifyStudy) {
    const active = schedule.filter((t) => t.start && t.due);
    for (let i = 0; i < prefs.horizonDays; i++) {
      const dayN = t0 + i, day = fromDayNumber(dayN);
      if (prefs.restWeekdays.includes(new Date(dayN * 86_400_000).getUTCDay())) continue;
      const covering = active.filter((t) => toDayNumber(t.start!) <= dayN && dayN <= toDayNumber(t.due!));
      if (!covering.length) continue;
      const fire = applyQuietHours(zonedTimeToUtc(day, prefs.studyTime, prefs.timezone), prefs);
      if (fire.getTime() <= now.getTime()) continue;
      const main = covering.find((t) => t.status === 'in_progress') ?? covering[0];
      out.push({
        kind: 'study_daily', dedupeKey: `study:${day}`, fireAt: fire.toISOString(),
        title: `Hôm nay học: ${taskNames[main.id] ?? main.id}`,
        body: covering.length > 1 ? `Và ${covering.length - 1} task khác. Mở app, học xong bấm Xong.` : 'Mở app, học xong bấm Xong.',
        deepLink: '/today',
      });
    }
  }

  if (prefs.notifyBuy) {
    for (const p of purchases) {
      if (!p.remind || p.urgency === 'later' || p.daysUntilOrderBy > prefs.horizonDays) continue;
      let day = toDayNumber(p.orderBy) > t0 ? p.orderBy : today; // quá hạn đặt thì nhắc ngay hôm nay
      let fire = applyQuietHours(zonedTimeToUtc(day, prefs.buyTime, prefs.timezone), prefs);
      if (fire.getTime() <= now.getTime()) {                      // giờ nhắc hôm nay đã qua: nhắc vào ngày mai
        day = fromDayNumber(toDayNumber(day) + 1);
        fire = applyQuietHours(zonedTimeToUtc(day, prefs.buyTime, prefs.timezone), prefs);
      }
      out.push({
        kind: 'buy_book', dedupeKey: `buy:${p.resourceId}:${p.orderBy}`, fireAt: fire.toISOString(),
        title: p.action === 'late_risk' ? `Có thể giao trễ: ${p.title}` : `Đặt mua: ${p.title}`,
        body: p.action === 'late_risk' ? `Dự kiến giao sau ngày bắt đầu học (${p.needBy}). Cân nhắc đổi cách mua.` : `Cần có vào ${p.needBy}. Đặt sớm để kịp ngày học.`,
        deepLink: '/buy',
      });
    }
  }
  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

export interface ExistingReminder { kind: string; dedupeKey: string; status: 'pending' | 'sent' | 'failed' | 'cancelled'; fireAt: string; title: string; body: string }
/** So bản mới với bảng reminders hiện có. Mục đã gửi không bao giờ bị đụng đến. */
export function diffReminders(existing: ExistingReminder[], drafts: ReminderDraft[]) {
  const key = (x: { kind: string; dedupeKey: string }) => `${x.kind}|${x.dedupeKey}`;
  const ex = new Map(existing.map((e) => [key(e), e]));
  const want = new Set(drafts.map(key));
  const toInsert: ReminderDraft[] = [], toUpdate: ReminderDraft[] = [], toCancel: ExistingReminder[] = [];
  for (const d of drafts) {
    const e = ex.get(key(d));
    if (!e) toInsert.push(d);
    else if (e.status === 'pending' && (e.fireAt !== d.fireAt || e.title !== d.title || e.body !== d.body)) toUpdate.push(d);
  }
  for (const e of existing) if (e.status === 'pending' && !want.has(key(e))) toCancel.push(e);
  return { toInsert, toUpdate, toCancel };
}
