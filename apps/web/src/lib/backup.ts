import { z } from 'zod';

export const BACKUP_FORMAT = 'roadmap-backup' as const;
export const BACKUP_VERSION = 1 as const;
export const BACKUP_MAX_BYTES = 1_000_000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'phải đúng định dạng YYYY-MM-DD');

const taskSchema = z
  .object({
    code: z.string().min(1),
    status: z.enum(['todo', 'in_progress', 'done', 'skipped']),
    writing_reps: z.number().int().min(0),
    kana_accuracy: z.number().min(0).max(1).nullable(),
    speaking_minutes: z.number().int().min(0),
    pinned_start: isoDate.nullable(),
    done_on: isoDate.nullable(),
  })
  .strict();

const resourceSchema = z
  .object({
    code: z.string().min(1),
    status: z.enum(['none', 'owned', 'ordered', 'received', 'not_needed']),
    opted_in: z.boolean(),
    ordered_on: isoDate.nullable(),
    eta: isoDate.nullable(),
  })
  .strict();

export const backupSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    template: z.object({ slug: z.string().min(1), version: z.string().min(1) }).strict(),
    plan: z
      .object({
        start_date: isoDate,
        hours_per_day: z.number().gt(0).lte(16),
        days_per_week: z.number().int().min(1).max(7),
        include_optional: z.boolean(),
        timezone: z.string().min(1),
      })
      .strict(),
    tasks: z.array(taskSchema),
    resources: z.array(resourceSchema),
  })
  .strict();

export type BackupPayload = z.infer<typeof backupSchema>;

export type ParseBackupResult = { ok: true; value: BackupPayload } | { ok: false; errors: string[] };

/** Đọc + validate nội dung file sao lưu. Giới hạn 1 MB, zod strict (từ chối khóa lạ), tối đa 10 lỗi. */
export function parseBackupFile(text: string): ParseBackupResult {
  if (new TextEncoder().encode(text).length > BACKUP_MAX_BYTES) {
    return { ok: false, errors: ['File vượt quá 1 MB'] };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['File không phải JSON hợp lệ'] };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const errors = result.error.issues.slice(0, 10).map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`);
    return { ok: false, errors };
  }
  return { ok: true, value: result.data };
}

/** Mọi code trong bản sao lưu phải thuộc đúng template (kiểm tra bằng danh mục đã đọc từ DB). Tối đa 10 lỗi. */
export function validateCodesBelongToTemplate(
  payload: BackupPayload,
  validTaskCodes: Set<string>,
  validResourceCodes: Set<string>
): string[] {
  const errors: string[] = [];
  for (const t of payload.tasks) {
    if (!validTaskCodes.has(t.code)) errors.push(`Mã task không thuộc template: ${t.code}`);
    if (errors.length >= 10) return errors;
  }
  for (const r of payload.resources) {
    if (!validResourceCodes.has(r.code)) errors.push(`Mã tài nguyên không thuộc template: ${r.code}`);
    if (errors.length >= 10) return errors;
  }
  return errors;
}

export interface BackupPreview {
  templateSlug: string;
  startDate: string;
  hoursPerDay: number;
  daysPerWeek: number;
  includeOptional: boolean;
  timezone: string;
  totalTasks: number;
  countByStatus: Record<string, number>;
  totalResources: number;
}

/** Tóm tắt bản sao lưu để hiển thị ở bước Xem trước. */
export function summarizeBackup(payload: BackupPayload): BackupPreview {
  const countByStatus: Record<string, number> = {};
  for (const t of payload.tasks) countByStatus[t.status] = (countByStatus[t.status] ?? 0) + 1;
  return {
    templateSlug: payload.template.slug,
    startDate: payload.plan.start_date,
    hoursPerDay: payload.plan.hours_per_day,
    daysPerWeek: payload.plan.days_per_week,
    includeOptional: payload.plan.include_optional,
    timezone: payload.plan.timezone,
    totalTasks: payload.tasks.length,
    countByStatus,
    totalResources: payload.resources.length,
  };
}

export interface RawTaskRow {
  code: string;
  status: string;
  writing_reps: number;
  kana_accuracy: number | null;
  speaking_minutes: number;
  pinned_start: string | null;
  done_on: string | null;
}
export interface RawResourceRow {
  code: string;
  status: string;
  opted_in: boolean;
  ordered_on: string | null;
  eta: string | null;
}

/** Ghép dữ liệu DB (đã đọc sẵn) thành đúng hình dạng bản sao lưu. Hàm thuần, không I/O. */
export function buildBackupPayload(
  templateSlug: string,
  templateVersion: string,
  plan: { startDate: string; hoursPerDay: number; daysPerWeek: number; includeOptional: boolean; timezone: string },
  tasks: RawTaskRow[],
  resources: RawResourceRow[]
): BackupPayload {
  return backupSchema.parse({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    template: { slug: templateSlug, version: templateVersion },
    plan: {
      start_date: plan.startDate,
      hours_per_day: plan.hoursPerDay,
      days_per_week: plan.daysPerWeek,
      include_optional: plan.includeOptional,
      timezone: plan.timezone,
    },
    tasks,
    resources,
  });
}
