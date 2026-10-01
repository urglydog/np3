/**
 * Bộ tính lịch cho Roadmap Planner (hàm thuần, không I/O).
 * Cùng một file chạy ở trình duyệt và ở worker nhắc việc, để lịch ở hai nơi không bao giờ lệch nhau.
 * Công thức khớp với file Sheet "Lo_Trinh_N3_Song_Ngu_IT_v4.2_Ban_Mau.xlsx" (xem references/golden-vectors.json).
 *
 * Ngày được biểu diễn bằng chuỗi 'YYYY-MM-DD' ở biên, và bằng số ngày (UTC) ở bên trong,
 * để không bao giờ dính lỗi múi giờ/giờ mùa hè khi cộng trừ ngày.
 */
export type Status = 'todo' | 'in_progress' | 'done' | 'skipped';

export interface TaskInput {
  id: string;
  estHours: number;        // giờ ước tính (> 0)
  status: Status;
  pinnedStart?: string | null; // 'YYYY-MM-DD': ghim ngày bắt đầu (cũng là cách lưu "Hoãn" và "Nghỉ")
}
export interface Settings {
  startDate: string;       // ngày người dùng muốn bắt đầu
  hoursPerDay: number;     // giờ học mỗi ngày học (> 0)
  daysPerWeek: number;     // 1..7
}
export interface ScheduledTask {
  id: string;
  status: Status;
  start: string | null;    // null với task done/skipped (không chiếm lịch)
  due: string | null;
  cumHours: number;        // giờ tích lũy của các task CHƯA xong, tính đến hết task này
  conflict: boolean;       // ghim sớm hơn lịch tự tính (trùng với task trước)
  pinClamped: boolean;     // ghim ở quá khứ nên bị đưa về ngày bắt đầu hiệu lực
}
export interface ScheduleResult {
  anchor: string;          // ngày bắt đầu hiệu lực = max(startDate, today)
  tasks: ScheduledTask[];
  finish: string | null;   // Due của task cuối cùng còn phải làm
  remainingHours: number;
  requiredHoursPerDayFor365: number | null;
}

const MS_PER_DAY = 86_400_000;
export function toDayNumber(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Ngày không hợp lệ: ${iso}`);
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (new Date(t).toISOString().slice(0, 10) !== iso) throw new Error(`Ngày không tồn tại: ${iso}`);
  return Math.round(t / MS_PER_DAY);
}
export function fromDayNumber(n: number): string {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}
/** Ngày hôm nay theo múi giờ của người dùng (mặc định Việt Nam). Truyền kết quả này vào computeSchedule. */
export function todayInTimeZone(tz = 'Asia/Ho_Chi_Minh', now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6; // chống sai số dấu phẩy động trước floor/ceil

export function validateSettings(s: Settings): void {
  if (!(s.hoursPerDay > 0 && s.hoursPerDay <= 16)) throw new Error('hoursPerDay phải trong (0, 16]');
  if (!(Number.isInteger(s.daysPerWeek) && s.daysPerWeek >= 1 && s.daysPerWeek <= 7)) throw new Error('daysPerWeek phải là số nguyên 1..7');
  toDayNumber(s.startDate);
}

export function computeSchedule(tasks: TaskInput[], settings: Settings, today: string): ScheduleResult {
  validateSettings(settings);
  const anchor = Math.max(toDayNumber(settings.startDate), toDayNumber(today));
  const hoursPerCalendarDay = (settings.hoursPerDay * settings.daysPerWeek) / 7; // giờ học trung bình mỗi ngày lịch
  const out: ScheduledTask[] = [];
  let cum = 0;
  let offset = 0; // tổng số ngày bị dời do ghim/hoãn/nghỉ, cộng dồn cho các task phía sau
  let lastDue = -Infinity;

  for (const t of tasks) {
    if (!(t.estHours > 0)) throw new Error(`estHours phải > 0 (task ${t.id})`);
    if (t.status === 'done' || t.status === 'skipped') {
      out.push({ id: t.id, status: t.status, start: null, due: null, cumHours: r6(cum), conflict: false, pinClamped: false });
      continue; // Done/Skipped không chiếm lịch
    }
    const before = cum;
    cum += t.estHours;
    let start = anchor + Math.floor(r6(before / hoursPerCalendarDay)) + offset;
    let conflict = false;
    let pinClamped = false;
    if (t.pinnedStart) {
      let p = toDayNumber(t.pinnedStart);
      if (p < anchor) { p = anchor; pinClamped = true; }  // ghim đã quá hạn thì hết hiệu lực, lịch quay về hôm nay
      if (p < start) conflict = true;                      // ghim sớm hơn lịch tự tính: vẫn tôn trọng nhưng báo trùng
      offset += p - start;
      start = p;
    }
    const due = Math.max(start, anchor + Math.ceil(r6(cum / hoursPerCalendarDay)) - 1 + offset);
    lastDue = Math.max(lastDue, due);
    out.push({ id: t.id, status: t.status, start: fromDayNumber(start), due: fromDayNumber(due), cumHours: r6(cum), conflict, pinClamped });
  }
  const remainingHours = r6(cum);
  return {
    anchor: fromDayNumber(anchor),
    tasks: out,
    finish: lastDue === -Infinity ? null : fromDayNumber(lastDue),
    remainingHours,
    requiredHoursPerDayFor365: remainingHours > 0 ? Math.round((remainingHours / ((365 * settings.daysPerWeek) / 7)) * 10) / 10 : null,
  };
}

/** Hoãn một task N ngày: ghim ngày bắt đầu = ngày bắt đầu hiện tại + N. Task đó và mọi task sau dời đúng N ngày. */
export function delayTask(tasks: TaskInput[], settings: Settings, today: string, taskId: string, days: number): TaskInput[] {
  if (!Number.isInteger(days) || days < 1) throw new Error('days phải là số nguyên >= 1');
  const cur = computeSchedule(tasks, settings, today).tasks.find((x) => x.id === taskId);
  if (!cur || !cur.start) throw new Error('Chỉ hoãn được task chưa xong');
  const p = fromDayNumber(toDayNumber(cur.start) + days);
  return tasks.map((t) => (t.id === taskId ? { ...t, pinnedStart: p } : t));
}

/** Ghim ngày bắt đầu của một task. Trả cảnh báo nếu ngày ghim sớm hơn lịch tự tính. */
export function pinTask(tasks: TaskInput[], taskId: string, date: string): TaskInput[] {
  toDayNumber(date);
  return tasks.map((t) => (t.id === taskId ? { ...t, pinnedStart: date } : t));
}

/** Nghỉ N ngày kể từ ngày D: dời task chưa xong đầu tiên có Start >= D (và mọi task sau nó) N ngày. */
export function insertBreak(tasks: TaskInput[], settings: Settings, today: string, fromDate: string, days: number): TaskInput[] {
  if (!Number.isInteger(days) || days < 1) throw new Error('days phải là số nguyên >= 1');
  const d = toDayNumber(fromDate);
  const first = computeSchedule(tasks, settings, today).tasks.find((x) => x.start && toDayNumber(x.start) >= d);
  if (!first) return tasks; // không còn task nào sau ngày nghỉ
  return delayTask(tasks, settings, today, first.id, days);
}
