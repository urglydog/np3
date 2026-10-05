// Kiểu dữ liệu sao lưu và Zod schema để kiểm tra file import.
// Không import Next/React/Supabase/DOM/fs — hàm thuần, theo quy tắc packages/core.
import { z } from 'zod';

// ── Schema từng bảng ────────────────────────────────────────────────────────

const planRowSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date phải là YYYY-MM-DD'),
  hours_per_day: z.number().positive().max(16),
  days_per_week: z.number().int().min(1).max(7),
  include_optional: z.boolean(),
  timezone: z.string().min(1),
  created_at: z.string(),
});

const taskStateRowSchema = z.object({
  task_id: z.string().uuid(),
  status: z.enum(['todo', 'in_progress', 'done', 'skipped']),
  writing_reps: z.number().int().min(0),
  kana_accuracy: z.number().min(0).max(1).nullable(),
  speaking_minutes: z.number().int().min(0),
  pinned_start: z.string().nullable(),
  done_on: z.string().nullable(),
});

const resourceStateRowSchema = z.object({
  resource_id: z.string().uuid(),
  status: z.enum(['none', 'owned', 'ordered', 'received', 'not_needed']),
  opted_in: z.boolean(),
  ordered_on: z.string().nullable(),
  eta: z.string().nullable(),
});

// ── Schema tổng (file JSON sao lưu) ─────────────────────────────────────────

export const backupDataSchema = z.object({
  /** Phiên bản cấu trúc file — tăng khi thay đổi schema không tương thích. */
  version: z.literal(1),
  /** ISO timestamp lúc xuất (dùng để hiển thị cho người dùng). */
  exported_at: z.string(),
  plan: planRowSchema,
  task_states: z.array(taskStateRowSchema),
  resource_states: z.array(resourceStateRowSchema),
});

// ── Types suy ra từ schema ───────────────────────────────────────────────────

export type BackupData = z.infer<typeof backupDataSchema>;
export type BackupPlanRow = z.infer<typeof planRowSchema>;
export type BackupTaskStateRow = z.infer<typeof taskStateRowSchema>;
export type BackupResourceStateRow = z.infer<typeof resourceStateRowSchema>;
