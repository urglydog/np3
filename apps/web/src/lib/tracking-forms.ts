export type FormResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseTaskId(formData: FormData): FormResult<string> {
  const v = formData.get('taskId');
  if (typeof v !== 'string' || v.length === 0) return { ok: false, error: 'Thiếu task' };
  return { ok: true, value: v };
}

function parseNonNegativeInt(raw: FormDataEntryValue | null, label: string): FormResult<number> {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: `${label} không được để trống` };
  if (!/^\d+$/.test(raw.trim())) return { ok: false, error: `${label} phải là số nguyên không âm` };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return { ok: false, error: `${label} phải là số nguyên không âm` };
  return { ok: true, value: n };
}

/** Nhập 0..100 (%), trả về 0..1 để lưu DB. */
function parseKanaAccuracyPercent(raw: FormDataEntryValue | null): FormResult<number> {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: 'Độ chính xác Kana không được để trống' };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, error: 'Độ chính xác Kana phải là số' };
  if (n < 0 || n > 100) return { ok: false, error: 'Độ chính xác Kana phải trong khoảng 0 đến 100' };
  return { ok: true, value: n / 100 };
}

export interface TrackingParams {
  taskId: string;
  writingReps: number;
  kanaAccuracy: number;
  speakingMinutes: number;
}

export function parseTrackingForm(formData: FormData): FormResult<TrackingParams> {
  const taskId = parseTaskId(formData);
  if (!taskId.ok) return taskId;

  const writingReps = parseNonNegativeInt(formData.get('writingReps'), 'Số lần viết');
  if (!writingReps.ok) return writingReps;

  const kanaAccuracy = parseKanaAccuracyPercent(formData.get('kanaAccuracy'));
  if (!kanaAccuracy.ok) return kanaAccuracy;

  const speakingMinutes = parseNonNegativeInt(formData.get('speakingMinutes'), 'Phút luyện nói');
  if (!speakingMinutes.ok) return speakingMinutes;

  return {
    ok: true,
    value: { taskId: taskId.value, writingReps: writingReps.value, kanaAccuracy: kanaAccuracy.value, speakingMinutes: speakingMinutes.value },
  };
}
