// Kiểm tra các hàm thuần "FormData -> tham số" cho 4 thao tác lịch (T-006).
import {
  parseToggleSkipForm,
  parseToggleDoneForm,
  parseUpdateStatsForm,
  parseDelayForm,
  parsePinForm,
  parseUnpinForm,
  parseBreakForm,
} from '../src/lib/schedule-forms';

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

// ---- parseToggleSkipForm ----
eq('toggleSkip: rỗng -> lỗi thiếu task', parseToggleSkipForm(fd({}), 'todo').ok, false);
eq('toggleSkip: task done -> lỗi', parseToggleSkipForm(fd({ taskId: 'A' }), 'done').ok, false);
eq('toggleSkip: hợp lệ', parseToggleSkipForm(fd({ taskId: 'A' }), 'todo'), { ok: true, value: { taskId: 'A' } });
eq('toggleSkip: hợp lệ với skipped', parseToggleSkipForm(fd({ taskId: 'A' }), 'skipped'), { ok: true, value: { taskId: 'A' } });

// ---- parseToggleDoneForm ----
eq('toggleDone: rỗng -> lỗi thiếu task', parseToggleDoneForm(fd({}), 'todo').ok, false);
eq('toggleDone: task skipped -> lỗi', parseToggleDoneForm(fd({ taskId: 'A' }), 'skipped').ok, false);
eq('toggleDone: hợp lệ với todo', parseToggleDoneForm(fd({ taskId: 'A' }), 'todo'), { ok: true, value: { taskId: 'A' } });
eq('toggleDone: hợp lệ với in_progress', parseToggleDoneForm(fd({ taskId: 'A' }), 'in_progress'), { ok: true, value: { taskId: 'A' } });
eq('toggleDone: hợp lệ với done (quay ngược)', parseToggleDoneForm(fd({ taskId: 'A' }), 'done'), { ok: true, value: { taskId: 'A' } });

// ---- parseUpdateStatsForm ----
eq('updateStats: rỗng -> lỗi thiếu task', parseUpdateStatsForm(fd({})).ok, false);
eq('updateStats: thiếu writingReps -> lỗi', parseUpdateStatsForm(fd({ taskId: 'A', speakingMinutes: '0' })).ok, false);
eq('updateStats: writingReps âm -> lỗi', parseUpdateStatsForm(fd({ taskId: 'A', writingReps: '-1', speakingMinutes: '0' })).ok, false);
eq('updateStats: accuracy ngoài 0-100 -> lỗi', parseUpdateStatsForm(fd({ taskId: 'A', writingReps: '0', speakingMinutes: '0', kanaAccuracyPercent: '150' })).ok, false);
eq('updateStats: hợp lệ không có accuracy', parseUpdateStatsForm(fd({ taskId: 'A', writingReps: '10', speakingMinutes: '5' })), {
  ok: true, value: { taskId: 'A', writingReps: 10, speakingMinutes: 5, kanaAccuracy: null },
});
eq('updateStats: hợp lệ có accuracy', parseUpdateStatsForm(fd({ taskId: 'A', writingReps: '10', speakingMinutes: '5', kanaAccuracyPercent: '85' })), {
  ok: true, value: { taskId: 'A', writingReps: 10, speakingMinutes: 5, kanaAccuracy: 0.85 },
});

// ---- parseDelayForm ----
eq('delay: rỗng -> lỗi', parseDelayForm(fd({ taskId: 'A' }), 'todo').ok, false);
eq('delay: days lạ (chữ) -> lỗi', parseDelayForm(fd({ taskId: 'A', days: 'abc' }), 'todo').ok, false);
eq('delay: days âm -> lỗi', parseDelayForm(fd({ taskId: 'A', days: '-3' }), 'todo').ok, false);
eq('delay: days = 0 -> lỗi (phải dương)', parseDelayForm(fd({ taskId: 'A', days: '0' }), 'todo').ok, false);
eq('delay: task done -> lỗi', parseDelayForm(fd({ taskId: 'A', days: '2' }), 'done').ok, false);
eq('delay: task skipped -> lỗi', parseDelayForm(fd({ taskId: 'A', days: '2' }), 'skipped').ok, false);
eq('delay: hợp lệ', parseDelayForm(fd({ taskId: 'A', days: '2' }), 'todo'), { ok: true, value: { taskId: 'A', days: 2 } });

// ---- parsePinForm ----
eq('pin: rỗng -> lỗi', parsePinForm(fd({ taskId: 'A' }), 'todo').ok, false);
eq('pin: ngày sai định dạng -> lỗi', parsePinForm(fd({ taskId: 'A', date: '01-10-2026' }), 'todo').ok, false);
eq('pin: ngày không tồn tại -> lỗi', parsePinForm(fd({ taskId: 'A', date: '2026-02-30' }), 'todo').ok, false);
eq('pin: task done -> lỗi', parsePinForm(fd({ taskId: 'A', date: '2026-10-05' }), 'done').ok, false);
eq('pin: hợp lệ', parsePinForm(fd({ taskId: 'A', date: '2026-10-05' }), 'in_progress'), {
  ok: true,
  value: { taskId: 'A', date: '2026-10-05' },
});

// ---- parseUnpinForm ----
eq('unpin: rỗng -> lỗi', parseUnpinForm(fd({}), 'todo').ok, false);
eq('unpin: task done -> lỗi', parseUnpinForm(fd({ taskId: 'A' }), 'done').ok, false);
eq('unpin: hợp lệ', parseUnpinForm(fd({ taskId: 'A' }), 'todo'), { ok: true, value: { taskId: 'A' } });

// ---- parseBreakForm ----
eq('break: rỗng -> lỗi', parseBreakForm(fd({})).ok, false);
eq('break: ngày lạ -> lỗi', parseBreakForm(fd({ fromDate: 'hôm nay', days: '2' })).ok, false);
eq('break: days âm -> lỗi', parseBreakForm(fd({ fromDate: '2026-10-05', days: '-1' })).ok, false);
eq('break: hợp lệ', parseBreakForm(fd({ fromDate: '2026-10-05', days: '3' })), {
  ok: true,
  value: { fromDate: '2026-10-05', days: 3 },
});

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
