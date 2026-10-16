import { z } from 'zod';
import {
  EMPTY_CARD_STATE,
  QUESTION_TYPES,
  SMART_STRATEGIES,
  type CardState,
  type ItemType,
  type MasteryLevel,
  type QuestionType,
  type QuizCandidate,
  type SmartStrategy,
} from '@roadmap/core';

/**
 * Phạm vi một phiên luyện, mã hoá trong URL (?scope=...) để trang quiz là GET thuần, tải lại được:
 *   lesson:3 · list:<uuid> · kanji:04e00.04e8c · smart:least_streak
 */
export type ReviewScope =
  | { kind: 'lesson'; lesson: number }
  | { kind: 'list'; listId: string }
  | { kind: 'kanji'; hexes: string[] }
  | { kind: 'smart'; strategy: SmartStrategy };

export const MAX_QUIZ_QUESTIONS = 200; // khớp trần p_limit của RPC review_get_quiz_batch
export const MAX_SCOPE_KANJI = 64;
const HEX_RE = /^[0-9a-f]{4,6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseScope(raw: string | undefined | null): ReviewScope | null {
  if (!raw) return null;
  const idx = raw.indexOf(':');
  if (idx < 0) return null;
  const kind = raw.slice(0, idx);
  const value = raw.slice(idx + 1);
  switch (kind) {
    case 'lesson': {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 32 ? { kind: 'lesson', lesson: n } : null;
    }
    case 'list':
      return UUID_RE.test(value) ? { kind: 'list', listId: value } : null;
    case 'kanji': {
      const hexes = [...new Set(value.split('.').map((h) => h.toLowerCase()))];
      if (hexes.length === 0 || hexes.length > MAX_SCOPE_KANJI || !hexes.every((h) => HEX_RE.test(h))) return null;
      return { kind: 'kanji', hexes };
    }
    case 'smart':
      return (SMART_STRATEGIES as readonly string[]).includes(value) ? { kind: 'smart', strategy: value as SmartStrategy } : null;
    default:
      return null;
  }
}

export function scopeToParam(scope: ReviewScope): string {
  switch (scope.kind) {
    case 'lesson':
      return `lesson:${scope.lesson}`;
    case 'list':
      return `list:${scope.listId}`;
    case 'kanji':
      return `kanji:${scope.hexes.join('.')}`;
    case 'smart':
      return `smart:${scope.strategy}`;
  }
}

const quizParamsSchema = z.object({
  scope: z.string().transform((s, ctx) => {
    const parsed = parseScope(s);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phạm vi luyện không hợp lệ' });
      return z.NEVER;
    }
    return parsed;
  }),
  types: z
    .string()
    .transform((s) => [...new Set(s.split(',').filter(Boolean))])
    .pipe(z.array(z.enum(['K1', 'E1', 'K2', 'E2'])).min(1, 'Chọn ít nhất một loại câu hỏi')),
  n: z.coerce.number().int().min(1, 'Số câu tối thiểu là 1').max(MAX_QUIZ_QUESTIONS, `Tối đa ${MAX_QUIZ_QUESTIONS} câu`),
});

export interface QuizParams {
  scope: ReviewScope;
  types: QuestionType[];
  n: number;
}

export function parseQuizParams(params: Record<string, string | string[] | undefined>): { ok: true; value: QuizParams } | { ok: false; error: string } {
  const pick = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const parsed = quizParamsSchema.safeParse({ scope: pick('scope') ?? '', types: pick('types') ?? '', n: pick('n') ?? '' });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Tham số không hợp lệ' };
  return { ok: true, value: parsed.data };
}

// ---------- Dựng QuizCandidate từ dữ liệu thô ----------
export interface CatalogRow {
  item_type: ItemType;
  item_id: string;
  question_type: QuestionType;
}
export interface CardStateRow {
  item_type: ItemType;
  item_id: string;
  question_type: QuestionType;
  correct_count: number;
  wrong_count: number;
  streak: number;
  mastery_level: MasteryLevel;
  last_reviewed_at: string | null;
}

export function toCardState(row: CardStateRow): CardState {
  return {
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    streak: row.streak,
    masteryLevel: row.mastery_level,
    lastReviewedAt: row.last_reviewed_at,
  };
}

/** Gộp danh mục thẻ (có thể trùng do một ví dụ thuộc nhiều bài) + trạng thái → mỗi mục một candidate, giữ thứ tự gặp đầu. */
export function buildCandidates(catalog: readonly CatalogRow[], states: readonly CardStateRow[]): QuizCandidate[] {
  const byItem = new Map<string, QuizCandidate>();
  const key = (t: ItemType, id: string) => `${t}:${id}`;
  for (const row of catalog) {
    const k = key(row.item_type, row.item_id);
    const c = byItem.get(k) ?? { itemType: row.item_type, itemId: row.item_id, applicableQuestionTypes: [], cardStates: {} };
    if (!c.applicableQuestionTypes.includes(row.question_type)) c.applicableQuestionTypes.push(row.question_type);
    byItem.set(k, c);
  }
  for (const s of states) {
    const c = byItem.get(key(s.item_type, s.item_id));
    if (c && c.applicableQuestionTypes.includes(s.question_type)) c.cardStates[s.question_type] = toCardState(s);
  }
  for (const c of byItem.values()) c.applicableQuestionTypes.sort((a, b) => QUESTION_TYPES.indexOf(a) - QUESTION_TYPES.indexOf(b));
  return [...byItem.values()];
}

/** Giữ lại các loại câu được chọn; bỏ mục không còn loại nào. */
export function restrictToTypes(candidates: readonly QuizCandidate[], types: readonly QuestionType[]): QuizCandidate[] {
  return candidates
    .map((c) => ({ ...c, applicableQuestionTypes: c.applicableQuestionTypes.filter((q) => types.includes(q)) }))
    .filter((c) => c.applicableQuestionTypes.length > 0);
}

/** Số câu tối đa theo từng loại — trang chọn phiên dùng để tính trần thanh trượt khi người dùng bật/tắt loại câu. */
export function countByType(candidates: readonly QuizCandidate[]): Record<QuestionType, number> {
  const out: Record<QuestionType, number> = { K1: 0, E1: 0, K2: 0, E2: 0 };
  for (const c of candidates) for (const q of c.applicableQuestionTypes) out[q]++;
  return out;
}

export function stateOf(c: QuizCandidate, q: QuestionType): CardState {
  return c.cardStates[q] ?? EMPTY_CARD_STATE;
}
