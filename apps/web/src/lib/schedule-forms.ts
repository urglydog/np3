import type { Status } from '@roadmap/core';

export type FormResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseTaskId(formData: FormData): FormResult<string> {
  const v = formData.get('taskId');
  if (typeof v !== 'string' || v.length === 0) return { ok: false, error: 'Thiếu task' };
  return { ok: true, value: v };
}

function parsePositiveInt(raw: FormDataEntryValue | null, label: string): FormResult<number> {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: `${label} không được để trống` };
  if (!/^-?\d+$/.test(raw.trim())) return { ok: false, error: `${label} phải là số nguyên` };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { ok: false, error: `${label} phải là số nguyên dương` };
  return { ok: true, value: n };
}

function parseIsoDate(raw: FormDataEntryValue | null, label: string): FormResult<string> {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: `${label} không hợp lệ` };
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
    return { ok: false, error: `${label} không tồn tại` };
  }
  return { ok: true, value: raw };
}

function assertNotDone(status: Status, action: string): { ok: false; error: string } | null {
  if (status === 'done') return { ok: false, error: `Task đã xong, không áp dụng ${action}` };
  return null;
}

export interface ToggleSkipParams {
  taskId: string;
}
export function parseToggleSkipForm(formData: FormData, currentStatus: Status): FormResult<ToggleSkipParams> {
  const taskId = parseTaskId(formData);
  if (!taskId.ok) return taskId;
  const guard = assertNotDone(currentStatus, 'Bỏ qua');
  if (guard) return guard;
  return { ok: true, value: { taskId: taskId.value } };
}

export interface ToggleDoneParams {
  taskId: string;
}
export function parseToggleDoneForm(formData: FormData, currentStatus: Status): FormResult<ToggleDoneParams> {
  const taskId = parseTaskId(formData);
  if (!taskId.ok) return taskId;
  if (currentStatus === 'skipped') return { ok: false, error: 'Task đang bị bỏ qua, bỏ "Bỏ qua" trước' };
  return { ok: true, value: { taskId: taskId.value } };
}

export interface UpdateStatsParams {
  taskId: string;
  writingReps: number;
  speakingMinutes: number;
  kanaAccuracy: number | null; // 0..1
}
function parseNonNegativeInt(raw: FormDataEntryValue | null, label: string): FormResult<number> {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: `${label} không được để trống` };
  if (!/^\d+$/.test(raw.trim())) return { ok: false, error: `${label} phải là số nguyên không âm` };
  return { ok: true, value: Number(raw) };
}
export function parseUpdateStatsForm(formData: FormData): FormResult<UpdateStatsParams> {
  const taskId = parseTaskId(formData);
  if (!taskId.ok) return taskId;
  const writingReps = parseNonNegativeInt(formData.get('writingReps'), 'Số lần viết');
  if (!writingReps.ok) return writingReps;
  const speakingMinutes = parseNonNegativeInt(formData.get('speakingMinutes'), 'Số phút nói');
  if (!speakingMinutes.ok) return speakingMinutes;

  const rawAccuracy = formData.get('kanaAccuracyPercent');
  let kanaAccuracy: number | null = null;
  if (typeof rawAccuracy === 'string' && rawAccuracy.trim() !== '') {
    const pct = Number(rawAccuracy);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { ok: false, error: 'Độ chính xác phải từ 0 đến 100' };
    }
    kanaAccuracy = Math.round(pct) / 100;
  }

  return {
    ok: true,
    value: { taskId: taskId.value, writingReps: writingReps.value, speakingMinutes: speakingMinutes.value, kanaAccuracy },
  };
}

export interface DelayParams {
  taskId: string;
  days: number;
}
export function parseDelayForm(formData: FormData, currentStatus: Status): FormResult<DelayParams> {
  const taskId = parseTaskId(formData);
  if (!taskId.ok) return taskId;
  const guard = assertNotDone(currentStatus, 'Hoãn');
  if (guard) return guard;
  if (currentStatus === 'skipped') return { ok: false, error: 'Task đang bỏ qua, không áp dụng Hoãn' };
  const days = parsePositiveInt(formData.get('days'), 'Số ngày hoãn');
  if (!days.ok) return days;
  return { ok: true, value: { taskId: taskId.value, days: days.value } };
}

export interface PinParams {
  taskId: string;
  date: string;
}
export function parsePinForm(formData: FormData, currentStatus: Status): FormResult<PinParams> {
  const taskId = parseTaskId(formData);
  if (!taskId.ok) return taskId;
  const guard = assertNotDone(currentStatus, 'Ghim ngày');
  if (guard) return guard;
  const date = parseIsoDate(formData.get('date'), 'Ngày ghim');
  if (!date.ok) return date;
  return { ok: true, value: { taskId: taskId.value, date: date.value } };
}

export interface UnpinParams {
  taskId: string;
}
export function parseUnpinForm(formData: FormData, currentStatus: Status): FormResult<UnpinParams> {
  const taskId = parseTaskId(formData);
  if (!taskId.ok) return taskId;
  const guard = assertNotDone(currentStatus, 'xóa ghim');
  if (guard) return guard;
  return { ok: true, value: { taskId: taskId.value } };
}

export interface BreakParams {
  fromDate: string;
  days: number;
}
export function parseBreakForm(formData: FormData): FormResult<BreakParams> {
  const fromDate = parseIsoDate(formData.get('fromDate'), 'Ngày bắt đầu nghỉ');
  if (!fromDate.ok) return fromDate;
  const days = parsePositiveInt(formData.get('days'), 'Số ngày nghỉ');
  if (!days.ok) return days;
  return { ok: true, value: { fromDate: fromDate.value, days: days.value } };
}
