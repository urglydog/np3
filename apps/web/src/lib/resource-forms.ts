import type { ResourceStatus } from '@roadmap/core';

export type FormResult<T> = { ok: true; value: T } | { ok: false; error: string };

const TARGET_STATUSES = ['owned', 'ordered', 'not_needed', 'received', 'none'] as const;
type TargetStatus = (typeof TARGET_STATUSES)[number];

/** Chuyển trạng thái hợp lệ: khoá là trạng thái hiện tại, giá trị là các đích được phép. */
const ALLOWED_TRANSITIONS: Record<ResourceStatus, TargetStatus[]> = {
  none: ['owned', 'ordered', 'not_needed'],
  ordered: ['received', 'none'],
  owned: [],
  not_needed: [],
  received: [],
};

function parseResourceId(formData: FormData): FormResult<string> {
  const v = formData.get('resourceId');
  if (typeof v !== 'string' || v.length === 0) return { ok: false, error: 'Thiếu tài nguyên' };
  return { ok: true, value: v };
}

function parseIsoDate(raw: FormDataEntryValue | null, label: string): FormResult<string> {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: `${label} không hợp lệ` };
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
    return { ok: false, error: `${label} không tồn tại` };
  }
  return { ok: true, value: raw };
}

export interface SetStatusParams {
  resourceId: string;
  targetStatus: TargetStatus;
  eta: string | null;
}

export function parseSetStatusForm(formData: FormData, currentStatus: ResourceStatus): FormResult<SetStatusParams> {
  const resourceId = parseResourceId(formData);
  if (!resourceId.ok) return resourceId;

  const rawTarget = formData.get('targetStatus');
  if (typeof rawTarget !== 'string' || !(TARGET_STATUSES as readonly string[]).includes(rawTarget)) {
    return { ok: false, error: 'Trạng thái đích không hợp lệ' };
  }
  const targetStatus = rawTarget as TargetStatus;

  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return { ok: false, error: `Không thể chuyển từ "${currentStatus}" sang "${targetStatus}"` };
  }

  if (targetStatus === 'ordered') {
    const eta = parseIsoDate(formData.get('eta'), 'Ngày dự kiến giao');
    if (!eta.ok) return eta;
    return { ok: true, value: { resourceId: resourceId.value, targetStatus, eta: eta.value } };
  }

  return { ok: true, value: { resourceId: resourceId.value, targetStatus, eta: null } };
}

export interface UpdateEtaParams {
  resourceId: string;
  eta: string;
}

export function parseUpdateEtaForm(formData: FormData, currentStatus: ResourceStatus): FormResult<UpdateEtaParams> {
  const resourceId = parseResourceId(formData);
  if (!resourceId.ok) return resourceId;
  if (currentStatus !== 'ordered') return { ok: false, error: 'Chỉ sửa được ngày dự kiến giao khi đang ở trạng thái "Đã đặt"' };
  const eta = parseIsoDate(formData.get('eta'), 'Ngày dự kiến giao');
  if (!eta.ok) return eta;
  return { ok: true, value: { resourceId: resourceId.value, eta: eta.value } };
}

export interface OptedInParams {
  resourceId: string;
  optedIn: boolean;
}

export function parseOptedInForm(formData: FormData): FormResult<OptedInParams> {
  const resourceId = parseResourceId(formData);
  if (!resourceId.ok) return resourceId;
  const optedIn = formData.get('optedIn') === 'on' || formData.get('optedIn') === 'true';
  return { ok: true, value: { resourceId: resourceId.value, optedIn } };
}
