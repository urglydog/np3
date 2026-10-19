/**
 * Module "Ôn luyện" — chuyển dữ liệu thô đã query ở `lib/review-data.ts` thành `QuizCandidate[]`
 * của `packages/core/src/review.ts` để dùng cho `pickQuizCandidates`/`buildQuizPlan`/`maxQuestionsFor`
 * ở màn "Tạo quiz mới" (`review/quiz/new`). Hàm THUẦN — không query Supabase, không đọc đồng hồ.
 */
import type { CardState, QuestionType, QuizCandidate } from '@roadmap/core';

export interface RawKanjiForQuiz {
  id: string;
  deckLesson: number;
  isKanji: boolean;
  hanVietMain: string | null;
  confirmedAt: string | null;
  k1State: CardState | null;
  k2State: CardState | null;
}

export interface RawExampleForQuiz {
  id: string;
  meaningVi: string | null;
  confirmedAt: string | null;
  lessons: number[]; // các bài VNJP chứa ví dụ này (review_example_kanji.lesson_context), có thể nhiều
  e1State: CardState | null;
  e2State: CardState | null;
}

/** Trả null nếu kanji không áp dụng được loại câu hỏi nào (không phải kanji thật/chưa xác nhận). */
export function buildKanjiCandidate(row: RawKanjiForQuiz): QuizCandidate | null {
  const applicable: QuestionType[] = row.isKanji && row.hanVietMain != null && row.confirmedAt != null ? ['K1', 'K2'] : [];
  if (applicable.length === 0) return null;
  return {
    itemType: 'kanji',
    itemId: row.id,
    applicableQuestionTypes: applicable,
    cardStates: { K1: row.k1State ?? undefined, K2: row.k2State ?? undefined },
  };
}

/** Trả null nếu ví dụ chưa có nghĩa tiếng Việt/chưa xác nhận. */
export function buildExampleCandidate(row: RawExampleForQuiz): QuizCandidate | null {
  const applicable: QuestionType[] = row.meaningVi != null && row.confirmedAt != null ? ['E1', 'E2'] : [];
  if (applicable.length === 0) return null;
  return {
    itemType: 'example',
    itemId: row.id,
    applicableQuestionTypes: applicable,
    cardStates: { E1: row.e1State ?? undefined, E2: row.e2State ?? undefined },
  };
}

// Tên tiếng Việt dễ hiểu cho 4 loại câu hỏi (không hiện mã K1/E1/K2/E2 ở UI theo plan §6.1).
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  K1: 'Đọc Hán Việt (kanji)',
  E1: 'Đọc Hán Việt (từ ví dụ)',
  K2: 'Viết kanji',
  E2: 'Viết từ tiếng Nhật',
};

// Tên tiếng Việt cho 4 chiến lược Smart quiz (SmartStrategy của packages/core).
export const SMART_STRATEGY_LABEL: Record<string, string> = {
  least_streak: 'Streak thấp nhất',
  least_accuracy: 'Độ chính xác thấp nhất',
  least_reviewed: 'Ít ôn nhất',
  unseen_first: 'Chưa luyện lần nào',
};
