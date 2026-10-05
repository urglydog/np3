import type { PurchaseItem, ResourceStatus } from '@roadmap/core';

export interface ResourceOutline {
  id: string;
  code: string;
  title: string;
  tier: 'core' | 'optional';
  priceVnd: number;
  priceCheckedAt: string | null;
  freeAlternative: string | null;
  buyUrl: string | null;
  isAffiliate: boolean;
  leadTimeDays: number;
  status: ResourceStatus;
  optedIn: boolean;
  orderedOn: string | null;
  eta: string | null;
}

export type PurchaseRow = ResourceOutline & { purchase: PurchaseItem | null };

/**
 * Ghép ResourceOutline (thông tin tĩnh của tài nguyên + trạng thái plan) với PurchaseItem (kết quả
 * needByDates/planPurchases của @roadmap/core, chỉ có cho tài nguyên ĐANG thật sự cần mua) theo id.
 * KHÔNG tính lại ngày cần có/hạn đặt ở đây. Ném lỗi nếu có PurchaseItem trỏ tới resource không có
 * trong outline — đó là dấu hiệu bug ở nơi đọc dữ liệu, không được bỏ qua im lặng.
 */
export function buildPurchaseRows(outline: ResourceOutline[], items: PurchaseItem[]): PurchaseRow[] {
  const outlineIds = new Set(outline.map((r) => r.id));
  const missing = items.filter((i) => !outlineIds.has(i.resourceId));
  if (missing.length > 0) {
    throw new Error(`buildPurchaseRows: ${missing.length} PurchaseItem trỏ tới resource không có trong outline (vd id ${missing[0].resourceId})`);
  }

  const itemById = new Map(items.map((i) => [i.resourceId, i]));
  return outline.map((r) => ({ ...r, purchase: itemById.get(r.id) ?? null }));
}
