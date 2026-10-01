/**
 * Kiểm tra và áp dụng "đề xuất điều chỉnh" do LLM trả về.
 * Nguyên tắc: LLM chỉ được CHỌN trong danh mục có sẵn và đề xuất con số trong biên cho phép.
 * Không có ngày tháng nào trong đầu ra của LLM (ngày do bộ tính lịch tính). Mọi thứ khác bị từ chối hoặc làm sạch.
 */
import type { TaskInput } from '../../roadmap-schedule-engine/scripts/schedule.ts';

export interface Adjustments {
  removeTaskCodes: string[];                          // bỏ task người học đã biết (sẽ thành 'skipped')
  hourOverrides: Record<string, number>;              // đổi số giờ ước tính của task có sẵn
  addTasks: { code: string; afterCode: string; name: string; estHours: number; resourceCodes: string[] }[];
  resourceChoices: { code: string; include: boolean }[]; // chọn dùng/không dùng tài nguyên 'optional'
  rationale: string;                                  // giải thích ngắn hiển thị cho người dùng
}
export interface Catalog {
  tasks: { code: string; estHours: number; optional: boolean }[]; // theo thứ tự lộ trình
  resources: { code: string; tier: 'core' | 'optional' }[];
}
export interface Limits { maxRemoveRatio: number; hourMin: number; hourMax: number; maxAdd: number; maxAddHours: number }
export const DEFAULT_LIMITS: Limits = { maxRemoveRatio: 0.5, hourMin: 0.5, hourMax: 2, maxAdd: 20, maxAddHours: 40 };

const KEYS = ['removeTaskCodes', 'hourOverrides', 'addTasks', 'resourceChoices', 'rationale'];
const ADD_KEYS = ['code', 'afterCode', 'name', 'estHours', 'resourceCodes'];

/** Làm sạch chuỗi tự do từ LLM: bỏ thẻ HTML, ký tự điều khiển, ép độ dài. Vẫn phải escape khi render. */
export function cleanText(s: string, max: number): string {
  return s.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export type Validation = { ok: true; value: Adjustments } | { ok: false; errors: string[] };

export function validateAdjustments(raw: unknown, cat: Catalog, limits: Limits = DEFAULT_LIMITS): Validation {
  const errors: string[] = [];
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
  if (!isObj(raw)) return { ok: false, errors: ['Đầu ra không phải đối tượng JSON'] };
  for (const k of Object.keys(raw)) if (!KEYS.includes(k)) errors.push(`Khóa lạ bị từ chối: ${k}`); // chặn cả "startDate", "dueDate"...
  const taskMap = new Map(cat.tasks.map((t) => [t.code, t]));
  const resMap = new Map(cat.resources.map((r) => [r.code, r]));

  const remove = raw.removeTaskCodes;
  if (!Array.isArray(remove) || !remove.every((c) => typeof c === 'string')) errors.push('removeTaskCodes phải là mảng chuỗi');
  else {
    for (const c of remove) if (!taskMap.has(c)) errors.push(`Mã task không có trong danh mục: ${c}`);
    if (new Set(remove).size !== remove.length) errors.push('removeTaskCodes có mã trùng');
    if (remove.length > cat.tasks.length * limits.maxRemoveRatio) errors.push(`Bỏ quá nhiều task (tối đa ${Math.floor(cat.tasks.length * limits.maxRemoveRatio)})`);
  }
  const ho = raw.hourOverrides;
  if (!isObj(ho)) errors.push('hourOverrides phải là đối tượng');
  else for (const [c, h] of Object.entries(ho)) {
    const t = taskMap.get(c);
    if (!t) errors.push(`hourOverrides: mã không có trong danh mục: ${c}`);
    else if (typeof h !== 'number' || !Number.isFinite(h)) errors.push(`hourOverrides ${c}: không phải số`);
    else if (h < t.estHours * limits.hourMin || h > t.estHours * limits.hourMax) errors.push(`hourOverrides ${c}: ${h} ngoài biên [${t.estHours * limits.hourMin}, ${t.estHours * limits.hourMax}]`);
  }
  const add = raw.addTasks;
  const seen = new Set<string>();
  if (!Array.isArray(add)) errors.push('addTasks phải là mảng');
  else {
    if (add.length > limits.maxAdd) errors.push(`Thêm quá nhiều task (tối đa ${limits.maxAdd})`);
    let addHours = 0;
    add.forEach((a, i) => {
      if (!isObj(a)) { errors.push(`addTasks[${i}] không hợp lệ`); return; }
      for (const k of Object.keys(a)) if (!ADD_KEYS.includes(k)) errors.push(`addTasks[${i}] khóa lạ: ${k}`);
      if (typeof a.code !== 'string' || !/^X-[A-Z0-9-]{1,20}$/.test(a.code)) errors.push(`addTasks[${i}].code phải dạng X-XXXX`);
      else if (taskMap.has(a.code) || seen.has(a.code)) errors.push(`addTasks[${i}].code trùng: ${a.code}`);
      else seen.add(a.code);
      if (typeof a.afterCode !== 'string' || !(taskMap.has(a.afterCode) || seen.has(a.afterCode))) errors.push(`addTasks[${i}].afterCode không có trong danh mục`);
      if (typeof a.name !== 'string' || cleanText(a.name, 120).length < 3) errors.push(`addTasks[${i}].name quá ngắn hoặc thiếu`);
      if (typeof a.estHours !== 'number' || !(a.estHours >= 0.5 && a.estHours <= 20)) errors.push(`addTasks[${i}].estHours phải trong [0.5, 20]`);
      else addHours += a.estHours;
      if (!Array.isArray(a.resourceCodes) || !a.resourceCodes.every((c) => typeof c === 'string' && resMap.has(c))) errors.push(`addTasks[${i}].resourceCodes chứa mã không có trong danh mục`);
    });
    if (addHours > limits.maxAddHours) errors.push(`Tổng giờ task thêm vượt ${limits.maxAddHours}`);
  }
  const rc = raw.resourceChoices;
  if (!Array.isArray(rc)) errors.push('resourceChoices phải là mảng');
  else rc.forEach((r, i) => {
    if (!isObj(r) || typeof r.code !== 'string' || typeof r.include !== 'boolean' || !resMap.has(r.code)) errors.push(`resourceChoices[${i}] không hợp lệ`);
    else if (resMap.get(r.code)!.tier === 'core' && r.include === false) errors.push(`Không được loại tài nguyên cốt lõi: ${r.code}`);
  });
  if (typeof raw.rationale !== 'string') errors.push('rationale phải là chuỗi');

  if (errors.length) return { ok: false, errors };
  const a = raw as unknown as Adjustments;
  return { ok: true, value: {
    removeTaskCodes: a.removeTaskCodes,
    hourOverrides: a.hourOverrides,
    addTasks: a.addTasks.map((t) => ({ ...t, name: cleanText(t.name, 120) })),
    resourceChoices: a.resourceChoices,
    rationale: cleanText(a.rationale, 500),
  } };
}

/** Áp dụng đề xuất (đã kiểm tra) lên danh mục -> danh sách TaskInput cho bộ tính lịch. */
export function applyAdjustments(cat: Catalog, adj: Adjustments): TaskInput[] {
  const out: TaskInput[] = [];
  const removed = new Set(adj.removeTaskCodes);
  const after = new Map<string, Adjustments['addTasks']>();
  for (const a of adj.addTasks) after.set(a.afterCode, [...(after.get(a.afterCode) ?? []), a]);
  const pushAdds = (code: string) => { for (const a of after.get(code) ?? []) { out.push({ id: a.code, estHours: a.estHours, status: 'todo' }); pushAdds(a.code); } };
  for (const t of cat.tasks) {
    out.push({ id: t.code, estHours: adj.hourOverrides[t.code] ?? t.estHours, status: removed.has(t.code) ? 'skipped' : 'todo' });
    pushAdds(t.code);
  }
  return out;
}
