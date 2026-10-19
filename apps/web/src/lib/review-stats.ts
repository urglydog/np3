import type { QuestionType } from '@roadmap/core';
import type { AttemptRow } from './review-data';

/**
 * Hàm thuần xử lý thống kê trang /review/stats — chỉ nhận dữ liệu đã đọc từ DB (AttemptRow[]), không tự
 * đọc đồng hồ/Supabase. Giữ ở apps/web (không ở packages/core) vì chỉ phục vụ hiển thị, không phải bất
 * biến nghiệp vụ (lịch/chấm điểm) — không cần mirror SQL.
 */

/** % đúng chung trên toàn bộ lịch sử. 0 lần → 0 (không NaN). */
export function overallAccuracyPct(attempts: readonly AttemptRow[]): number {
  if (attempts.length === 0) return 0;
  const correct = attempts.filter((a) => a.is_correct).length;
  return Math.round((correct / attempts.length) * 100);
}

export interface TypeAccuracy {
  questionType: QuestionType;
  total: number;
  correct: number;
  pct: number; // 0 nếu total = 0
}

/** % đúng theo từng loại câu hỏi, giữ thứ tự K1/E1/K2/E2. */
export function accuracyByQuestionType(attempts: readonly AttemptRow[]): TypeAccuracy[] {
  const order: QuestionType[] = ['K1', 'E1', 'K2', 'E2'];
  return order.map((questionType) => {
    const xs = attempts.filter((a) => a.question_type === questionType);
    const correct = xs.filter((a) => a.is_correct).length;
    return { questionType, total: xs.length, correct, pct: xs.length === 0 ? 0 : Math.round((correct / xs.length) * 100) };
  });
}

export interface DayAccuracy {
  day: string; // 'YYYY-MM-DD' theo giờ UTC của answered_at (chuỗi ISO lưu sẵn, không tự đọc đồng hồ)
  total: number;
  correct: number;
  pct: number;
}

/** Gộp theo ngày (UTC, lấy từ answered_at), giữ thứ tự thời gian tăng dần. Dùng để vẽ biểu đồ đường. */
export function groupAttemptsByDay(attempts: readonly AttemptRow[]): DayAccuracy[] {
  const byDay = new Map<string, { total: number; correct: number }>();
  for (const a of attempts) {
    const day = a.answered_at.slice(0, 10);
    const cur = byDay.get(day) ?? { total: 0, correct: 0 };
    cur.total += 1;
    if (a.is_correct) cur.correct += 1;
    byDay.set(day, cur);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, { total, correct }]) => ({ day, total, correct, pct: total === 0 ? 0 : Math.round((correct / total) * 100) }));
}
