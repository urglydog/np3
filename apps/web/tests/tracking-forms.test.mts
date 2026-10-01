// Kiểm tra parseTrackingForm: ghi nhận hằng ngày (số lần viết, độ chính xác Kana, phút luyện nói).
import { parseTrackingForm } from '../src/lib/tracking-forms';

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

eq('rỗng -> lỗi thiếu task', parseTrackingForm(fd({})).ok, false);
eq('thiếu writingReps -> lỗi', parseTrackingForm(fd({ taskId: 'A', kanaAccuracy: '80', speakingMinutes: '5' })).ok, false);
eq('writingReps âm -> lỗi', parseTrackingForm(fd({ taskId: 'A', writingReps: '-1', kanaAccuracy: '80', speakingMinutes: '5' })).ok, false);
eq('writingReps không phải số -> lỗi', parseTrackingForm(fd({ taskId: 'A', writingReps: 'abc', kanaAccuracy: '80', speakingMinutes: '5' })).ok, false);
eq('speakingMinutes âm -> lỗi', parseTrackingForm(fd({ taskId: 'A', writingReps: '10', kanaAccuracy: '80', speakingMinutes: '-5' })).ok, false);
eq('kanaAccuracy ngoài 0..100 (âm) -> lỗi', parseTrackingForm(fd({ taskId: 'A', writingReps: '10', kanaAccuracy: '-1', speakingMinutes: '5' })).ok, false);
eq('kanaAccuracy ngoài 0..100 (>100) -> lỗi', parseTrackingForm(fd({ taskId: 'A', writingReps: '10', kanaAccuracy: '101', speakingMinutes: '5' })).ok, false);
eq('kanaAccuracy không phải số -> lỗi', parseTrackingForm(fd({ taskId: 'A', writingReps: '10', kanaAccuracy: 'tốt', speakingMinutes: '5' })).ok, false);

eq(
  'hợp lệ: 80 -> lưu 0.8',
  parseTrackingForm(fd({ taskId: 'A', writingReps: '10', kanaAccuracy: '80', speakingMinutes: '5' })),
  { ok: true, value: { taskId: 'A', writingReps: 10, kanaAccuracy: 0.8, speakingMinutes: 5 } }
);
eq(
  'hợp lệ: biên 0 và 100',
  parseTrackingForm(fd({ taskId: 'A', writingReps: '0', kanaAccuracy: '0', speakingMinutes: '0' })),
  { ok: true, value: { taskId: 'A', writingReps: 0, kanaAccuracy: 0, speakingMinutes: 0 } }
);
eq(
  'hợp lệ: biên 100',
  parseTrackingForm(fd({ taskId: 'A', writingReps: '0', kanaAccuracy: '100', speakingMinutes: '0' })),
  { ok: true, value: { taskId: 'A', writingReps: 0, kanaAccuracy: 1, speakingMinutes: 0 } }
);

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
