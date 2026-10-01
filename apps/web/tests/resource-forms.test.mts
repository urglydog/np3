// Kiểm tra các hàm thuần "FormData -> tham số" cho thao tác trên /buy (T-007).
import { parseSetStatusForm, parseUpdateEtaForm, parseOptedInForm } from '../src/lib/resource-forms';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

const fd = (obj: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.append(k, v);
  return f;
};

// ---- parseSetStatusForm ----
eq('setStatus: rỗng -> lỗi thiếu resource', parseSetStatusForm(fd({}), 'none').ok, false);
eq('setStatus: targetStatus lạ -> lỗi', parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'mua-roi' }), 'none').ok, false);
eq(
  'setStatus: none -> owned hợp lệ',
  parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'owned' }), 'none'),
  { ok: true, value: { resourceId: 'A', targetStatus: 'owned', eta: null } }
);
eq('setStatus: none -> ordered thiếu eta -> lỗi', parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'ordered' }), 'none').ok, false);
eq('setStatus: none -> ordered eta sai định dạng -> lỗi', parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'ordered', eta: '01-11-2026' }), 'none').ok, false);
eq(
  'setStatus: none -> ordered eta hợp lệ',
  parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'ordered', eta: '2026-11-01' }), 'none'),
  { ok: true, value: { resourceId: 'A', targetStatus: 'ordered', eta: '2026-11-01' } }
);
eq(
  'setStatus: chuyển không hợp lệ — none -> received (chưa đặt mà nhận)',
  parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'received' }), 'none').ok,
  false
);
eq('setStatus: ordered -> received hợp lệ', parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'received' }), 'ordered'), {
  ok: true,
  value: { resourceId: 'A', targetStatus: 'received', eta: null },
});
eq('setStatus: ordered -> none (hủy) hợp lệ', parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'none' }), 'ordered'), {
  ok: true,
  value: { resourceId: 'A', targetStatus: 'none', eta: null },
});
eq('setStatus: owned -> bất kỳ -> lỗi (owned là trạng thái cuối)', parseSetStatusForm(fd({ resourceId: 'A', targetStatus: 'none' }), 'owned').ok, false);

// ---- parseUpdateEtaForm ----
eq('updateEta: rỗng -> lỗi', parseUpdateEtaForm(fd({ resourceId: 'A' }), 'ordered').ok, false);
eq('updateEta: ngày sai định dạng -> lỗi', parseUpdateEtaForm(fd({ resourceId: 'A', eta: 'hôm nay' }), 'ordered').ok, false);
eq('updateEta: ngày không tồn tại -> lỗi', parseUpdateEtaForm(fd({ resourceId: 'A', eta: '2026-02-30' }), 'ordered').ok, false);
eq('updateEta: chưa ordered -> lỗi', parseUpdateEtaForm(fd({ resourceId: 'A', eta: '2026-11-05' }), 'none').ok, false);
eq('updateEta: hợp lệ', parseUpdateEtaForm(fd({ resourceId: 'A', eta: '2026-11-05' }), 'ordered'), {
  ok: true,
  value: { resourceId: 'A', eta: '2026-11-05' },
});

// ---- parseOptedInForm ----
eq('optedIn: rỗng -> lỗi thiếu resource', parseOptedInForm(fd({})).ok, false);
eq('optedIn: không tick -> false', parseOptedInForm(fd({ resourceId: 'A' })), { ok: true, value: { resourceId: 'A', optedIn: false } });
eq('optedIn: có tick -> true', parseOptedInForm(fd({ resourceId: 'A', optedIn: 'on' })), {
  ok: true,
  value: { resourceId: 'A', optedIn: true },
});

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
