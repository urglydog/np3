// Kiểm tra parseBackupFile/validateCodesBelongToTemplate/summarizeBackup/buildBackupPayload (T-008).
import { parseBackupFile, validateCodesBelongToTemplate, summarizeBackup, buildBackupPayload, BACKUP_MAX_BYTES } from '../src/lib/backup';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

const validPayload = {
  format: 'roadmap-backup',
  version: 1,
  template: { slug: 'jlpt-n3-it', version: '4.2' },
  plan: { start_date: '2026-10-01', hours_per_day: 2, days_per_week: 6, include_optional: false, timezone: 'Asia/Ho_Chi_Minh' },
  tasks: [
    { code: 'PH1-H01', status: 'done', writing_reps: 100, kana_accuracy: 0.9, speaking_minutes: 10, pinned_start: null, done_on: '2026-10-02' },
    { code: 'PH1-H02', status: 'todo', writing_reps: 0, kana_accuracy: null, speaking_minutes: 0, pinned_start: null, done_on: null },
  ],
  resources: [{ code: 'RES-01', status: 'owned', opted_in: true, ordered_on: null, eta: null }],
};

// ---- parseBackupFile ----
{
  const r = parseBackupFile(JSON.stringify(validPayload));
  eq('payload hợp lệ -> ok', r.ok, true);
}
{
  const r = parseBackupFile('không phải json');
  eq('không phải JSON -> lỗi', r.ok, false);
}
{
  const r = parseBackupFile(JSON.stringify({ ...validPayload, format: 'other' }));
  eq('sai format -> lỗi', r.ok, false);
}
{
  const r = parseBackupFile(JSON.stringify({ ...validPayload, version: 2 }));
  eq('sai version -> lỗi', r.ok, false);
}
{
  const r = parseBackupFile(JSON.stringify({ ...validPayload, unknownKey: 'x' }));
  eq('khóa lạ ở gốc -> lỗi (zod strict)', r.ok, false);
}
{
  const r = parseBackupFile(JSON.stringify({ ...validPayload, tasks: [{ ...validPayload.tasks[0], extra: 'x' }] }));
  eq('khóa lạ trong task -> lỗi (zod strict)', r.ok, false);
}
{
  const r = parseBackupFile(JSON.stringify({ ...validPayload, plan: { ...validPayload.plan, days_per_week: 8 } }));
  eq('days_per_week ngoài biên -> lỗi', r.ok, false);
}
{
  const big = 'a'.repeat(BACKUP_MAX_BYTES + 10);
  const r = parseBackupFile(big);
  eq('vượt quá 1 MB -> lỗi, không parse JSON', r.ok, false);
}
{
  // nhiều lỗi cùng lúc -> tối đa 10
  const bad = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10, k: 11, l: 12 };
  const r = parseBackupFile(JSON.stringify(bad));
  eq('nhiều lỗi -> giới hạn tối đa 10', r.ok === false && r.errors.length <= 10, true);
}

// ---- validateCodesBelongToTemplate ----
{
  const errors = validateCodesBelongToTemplate(validPayload as never, new Set(['PH1-H01', 'PH1-H02']), new Set(['RES-01']));
  eq('mọi code đều thuộc template -> không lỗi', errors.length, 0);
}
{
  const errors = validateCodesBelongToTemplate(validPayload as never, new Set(['PH1-H01']), new Set(['RES-01']));
  eq('thiếu PH1-H02 trong danh mục hợp lệ -> báo lỗi', errors.length, 1);
}
{
  const errors = validateCodesBelongToTemplate(validPayload as never, new Set(['PH1-H01', 'PH1-H02']), new Set());
  eq('thiếu RES-01 trong danh mục hợp lệ -> báo lỗi', errors.length, 1);
}

// ---- summarizeBackup ----
{
  const s = summarizeBackup(validPayload as never);
  eq('đếm đúng theo trạng thái', s.countByStatus, { done: 1, todo: 1 });
  eq('tổng task/resource đúng', [s.totalTasks, s.totalResources], [2, 1]);
}

// ---- buildBackupPayload ----
{
  const p = buildBackupPayload(
    'jlpt-n3-it',
    '4.2',
    { startDate: '2026-10-01', hoursPerDay: 2, daysPerWeek: 6, includeOptional: false, timezone: 'Asia/Ho_Chi_Minh' },
    [{ code: 'PH1-H01', status: 'todo', writing_reps: 0, kana_accuracy: null, speaking_minutes: 0, pinned_start: null, done_on: null }],
    []
  );
  eq('buildBackupPayload ra đúng format/version', [p.format, p.version], ['roadmap-backup', 1]);
  eq('buildBackupPayload giữ đúng template slug', p.template.slug, 'jlpt-n3-it');
}

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
