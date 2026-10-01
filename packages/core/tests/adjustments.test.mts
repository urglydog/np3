// Chạy: npx tsx run-tests.mts
import { readFileSync } from 'node:fs';
import { computeSchedule } from '../src/schedule';
import { applyAdjustments, cleanText, validateAdjustments, type Catalog } from '../src/adjustments';
let fails = 0, checks = 0;
const eq = (l: string, g: unknown, w: unknown) => { checks++; if (JSON.stringify(g) !== JSON.stringify(w)) { fails++; console.error(`FAIL ${l}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); } };

interface TplTask { code: string; est_hours: number; optional: boolean }
interface TplResource { code: string; tier: 'core' | 'optional' }
const tpl: { tasks: TplTask[]; resources: TplResource[] } = JSON.parse(readFileSync(new URL('./fixtures/n3-template.json', import.meta.url), 'utf8'));
const cat: Catalog = { tasks: tpl.tasks.map((t) => ({ code: t.code, estHours: t.est_hours, optional: t.optional })), resources: tpl.resources.map((r) => ({ code: r.code, tier: r.tier })) };
const good = { removeTaskCodes: ['PH1-H01', 'PH1-H02'], hourOverrides: { 'PH2A-M01': 6 }, addTasks: [{ code: 'X-IT1', afterCode: 'PH3-IT05', name: 'Luyện đọc tài liệu kỹ thuật', estHours: 6, resourceCodes: ['RES-10'] }], resourceChoices: [{ code: 'RES-09', include: false }], rationale: 'Bạn đã biết Hiragana hàng A và Ka.' };
const v = validateAdjustments(good, cat);
eq('hợp lệ', v.ok, true);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cần mutate tự do để dựng dữ liệu đầu vào không hợp lệ cho test
const bad = (label: string, mutate: (o: any) => void, expectSub: string) => {
  const o = JSON.parse(JSON.stringify(good)); mutate(o);
  const r = validateAdjustments(o, cat);
  checks++; if (r.ok || !r.errors.some((e) => e.includes(expectSub))) { fails++; console.error(`FAIL ${label}: ${JSON.stringify(r)}`); }
};
bad('mã task bịa', (o) => o.removeTaskCodes.push('PH9-ZZZ'), 'không có trong danh mục');
bad('giờ ngoài biên', (o) => (o.hourOverrides['PH2A-M01'] = 500), 'ngoài biên');
bad('giờ không phải số', (o) => (o.hourOverrides['PH2A-M01'] = '6'), 'không phải số');
bad('LLM tự chèn ngày', (o) => (o.startDate = '2026-01-01'), 'Khóa lạ');
bad('LLM chèn ngày trong task thêm', (o) => (o.addTasks[0].dueDate = '2026-01-01'), 'khóa lạ');
bad('sách bịa', (o) => (o.addTasks[0].resourceCodes = ['RES-99']), 'không có trong danh mục');
bad('mã task thêm mạo danh mã có sẵn', (o) => { o.addTasks[0].code = 'PH1-H01'; }, 'code phải dạng X-');
bad('hai task thêm trùng mã nhau', (o) => { o.addTasks.push({ ...o.addTasks[0] }); }, 'trùng');
bad('afterCode bịa', (o) => (o.addTasks[0].afterCode = 'NOPE'), 'afterCode');
bad('loại tài nguyên cốt lõi', (o) => o.resourceChoices.push({ code: 'RES-04', include: false }), 'cốt lõi');
bad('bỏ quá nửa task', (o) => (o.removeTaskCodes = tpl.tasks.slice(0, 80).map((t) => t.code)), 'Bỏ quá nhiều');
bad('thiếu trường', (o) => delete o.rationale, 'rationale');
eq('không phải object', validateAdjustments('xin chào', cat).ok, false);
eq('mảng', validateAdjustments([], cat).ok, false);

// Làm sạch văn bản (chống nhồi HTML/script vào tên task hiển thị)
eq('cleanText', cleanText('<img src=x onerror=alert(1)>Học  Kanji\n\tIT', 120), 'Học Kanji IT');
const inj = validateAdjustments({ ...good, addTasks: [{ ...good.addTasks[0], name: '<script>alert(1)</script>Đọc tài liệu' }] }, cat);
eq('chặn script trong tên', inj.ok && inj.value.addTasks[0].name, 'alert(1)Đọc tài liệu');

// Áp dụng + tính lịch trên mẫu thật: bỏ H01,H02; H01 và H02 là 1.5h mỗi task; thêm 6h; đổi Minna bài 1 sang 6h
if (v.ok) {
  const tasks = applyAdjustments(cat, v.value);
  eq('số task = 113 + 1 thêm', tasks.length, 114);
  eq('task bỏ => skipped', tasks.filter((t) => t.status === 'skipped').map((t) => t.id), ['PH1-H01', 'PH1-H02']);
  eq('task thêm nằm ngay sau PH3-IT05', tasks[tasks.findIndex((t) => t.id === 'PH3-IT05') + 1].id, 'X-IT1');
  const base = computeSchedule(tasks.map((t) => ({ ...t, status: 'todo' as const })), { startDate: '2026-10-01', hoursPerDay: 2, daysPerWeek: 6 }, '2026-09-30');
  const adj = computeSchedule(tasks, { startDate: '2026-10-01', hoursPerDay: 2, daysPerWeek: 6 }, '2026-09-30');
  eq('bỏ task + đổi giờ => tổng giờ còn lại thay đổi đúng', adj.remainingHours, base.remainingHours - 3);
}
console.log(`${checks - fails}/${checks} kiểm tra đạt`); process.exit(fails ? 1 : 0);
