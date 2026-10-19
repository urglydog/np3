/**
 * Module "Ôn luyện" — tổng hợp dữ liệu cho Home + Stats. Hàm THUẦN: nhận mảng dữ liệu thô làm
 * tham số, KHÔNG tự query Supabase (giữ đúng pattern tách query khỏi tính toán, dễ test sau nếu cần).
 * Phần tính mastery/so khớp đã có ở packages/core/src/review.ts — file này KHÔNG viết lại logic đó,
 * chỉ gộp/nhóm dữ liệu cho UI (đếm theo mastery level, nhóm log theo ngày, accuracy theo loại câu hỏi).
 */
import type { MasteryLevel } from '@roadmap/core';

export const MASTERY_LEVEL_ORDER: MasteryLevel[] = ['mastered', 'good', 'to_confirm', 'bad', 'new'];

export interface MasteryBreakdownRow {
  level: MasteryLevel;
  count: number;
}

/** Đếm số lượng theo từng mức mastery, giữ đủ 5 mức theo thứ tự cố định (0 hợp lệ, không bỏ hàng). */
export function masteryBreakdown(levels: MasteryLevel[]): MasteryBreakdownRow[] {
  const counts: Record<MasteryLevel, number> = { new: 0, bad: 0, to_confirm: 0, good: 0, mastered: 0 };
  for (const level of levels) counts[level] += 1;
  return MASTERY_LEVEL_ORDER.map((level) => ({ level, count: counts[level] }));
}

export interface LessonCell {
  lesson: number;
  hasData: boolean; // false = bài chưa seed dữ liệu — hiện mờ/khoá, KHÔNG coi là lỗi
  masteredPct: number; // 0..100, chỉ có ý nghĩa khi hasData=true
}

/**
 * Dựng lưới N bài cố định (N = TOTAL_BOOK_LESSONS của packages/core) cho Home, phân biệt "chưa có
 * dữ liệu" (lesson không nằm trong seededLessons) với "đã có dữ liệu, 0% mastered" (hasData=true,
 * masteredPct=0).
 */
export function buildLessonGrid(
  totalLessons: number,
  seededLessons: ReadonlySet<number>,
  masteredRatioByLesson: ReadonlyMap<number, number>,
): LessonCell[] {
  const out: LessonCell[] = [];
  for (let lesson = 1; lesson <= totalLessons; lesson++) {
    const hasData = seededLessons.has(lesson);
    out.push({
      lesson,
      hasData,
      masteredPct: hasData ? Math.round((masteredRatioByLesson.get(lesson) ?? 0) * 100) : 0,
    });
  }
  return out;
}

// ============ Stats page: nhóm review_attempt_log ============

export type ReviewQuestionType = 'K1' | 'E1' | 'K2' | 'E2';

export interface AttemptRaw {
  answeredAtIso: string; // review_attempt_log.answered_at (timestamptz ISO)
  questionType: ReviewQuestionType;
  isCorrect: boolean;
}

export interface DayPoint {
  date: string; // 'YYYY-MM-DD', chỉ để NHÓM lịch sử trả lời theo ngày — không phải ngày lịch học
  total: number;
  correct: number;
  accuracyPct: number;
}

/**
 * Gộp log theo NGÀY (lấy phần date từ answeredAtIso bằng slice chuỗi, không dùng `new Date()` để so
 * sánh "hôm nay" — đây chỉ là nhóm dữ liệu lịch sử cho biểu đồ, không phải tính Start/Due nên không
 * thuộc phạm vi bất biến #1 CLAUDE.md, nhưng vẫn tránh lẫn lộn khái niệm "hôm nay").
 */
export function groupAttemptsByDay(attempts: AttemptRaw[]): DayPoint[] {
  const map = new Map<string, { total: number; correct: number }>();
  for (const a of attempts) {
    const date = a.answeredAtIso.slice(0, 10);
    const cur = map.get(date) ?? { total: 0, correct: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    map.set(date, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({
      date,
      total: v.total,
      correct: v.correct,
      accuracyPct: v.total === 0 ? 0 : Math.round((v.correct / v.total) * 100),
    }));
}

export interface QuestionTypeAccuracy {
  questionType: ReviewQuestionType;
  total: number;
  correct: number;
  accuracyPct: number;
}

const QUESTION_TYPES: ReviewQuestionType[] = ['K1', 'E1', 'K2', 'E2'];

/** Accuracy theo từng loại câu hỏi (K1/E1/K2/E2); total=0 -> accuracyPct=0 (không NaN). */
export function accuracyByQuestionType(attempts: AttemptRaw[]): QuestionTypeAccuracy[] {
  return QUESTION_TYPES.map((questionType) => {
    const rows = attempts.filter((a) => a.questionType === questionType);
    const total = rows.length;
    const correct = rows.filter((a) => a.isCorrect).length;
    return { questionType, total, correct, accuracyPct: total === 0 ? 0 : Math.round((correct / total) * 100) };
  });
}

/** Accuracy tổng trên toàn bộ attempt log; total=0 -> 0 (không NaN). */
export function overallAccuracyPct(attempts: AttemptRaw[]): number {
  if (attempts.length === 0) return 0;
  const correct = attempts.filter((a) => a.isCorrect).length;
  return Math.round((correct / attempts.length) * 100);
}
