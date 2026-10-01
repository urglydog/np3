// Kiểm tra buildPurchaseRows: ghép ResourceOutline + PurchaseItem theo id, không tính lại ngày.
import { buildPurchaseRows, type ResourceOutline } from '../src/lib/buy';
import type { PurchaseItem } from '@roadmap/core';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

const R = (id: string, overrides: Partial<ResourceOutline> = {}): ResourceOutline => ({
  id,
  code: id,
  title: `Tài nguyên ${id}`,
  tier: 'core',
  priceVnd: 100000,
  priceCheckedAt: '2026-09-01',
  freeAlternative: null,
  buyUrl: null,
  isAffiliate: false,
  leadTimeDays: 5,
  status: 'none',
  optedIn: true,
  orderedOn: null,
  eta: null,
  ...overrides,
});

const PI = (resourceId: string, overrides: Partial<PurchaseItem> = {}): PurchaseItem => ({
  resourceId,
  title: `Tài nguyên ${resourceId}`,
  needBy: '2026-10-10',
  orderBy: '2026-10-02',
  daysUntilOrderBy: 1,
  urgency: 'due_soon',
  action: 'order',
  remind: true,
  priceVnd: 100000,
  ...overrides,
});

// Resource có nhu cầu (có PurchaseItem) và resource không có nhu cầu (purchase=null) đều giữ đủ thông tin tĩnh
{
  const outline = [R('A'), R('B', { status: 'owned' })];
  const rows = buildPurchaseRows(outline, [PI('A')]);
  eq('A có purchase', rows[0].purchase?.resourceId, 'A');
  eq('B không có purchase (đã có sẵn)', rows[1].purchase, null);
  eq('giữ nguyên thông tin tĩnh của B', rows[1].status, 'owned');
}

// Resource optional chưa opted_in: không có PurchaseItem (đúng theo planPurchases), vẫn hiển thị trong outline
{
  const outline = [R('OPT', { tier: 'optional', optedIn: false })];
  const rows = buildPurchaseRows(outline, []);
  eq('optional chưa bật vẫn có trong danh sách, purchase=null', [rows[0].id, rows[0].purchase], ['OPT', null]);
}

// PurchaseItem trỏ tới resource lạ (không có trong outline) -> phải ném lỗi, không bỏ qua im lặng
{
  let threw = false;
  try {
    buildPurchaseRows([R('A')], [PI('KHÔNG-TỒN-TẠI')]);
  } catch {
    threw = true;
  }
  eq('PurchaseItem trỏ resource lạ phải ném lỗi', threw, true);
}

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
