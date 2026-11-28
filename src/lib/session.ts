import { ALL_QUESTIONS_BY_ID, type CourseBundle, QUESTIONS } from '../data/questionBank';
import type {
  ActiveSession,
  Question,
  QuestionFilterType,
  StudyMode,
} from '../types';
import { AggregateStats, filterQuestions } from './stats';

export function getFilterLabels(course?: CourseBundle): Record<QuestionFilterType, string> {
  const total = course ? course.questions.length : QUESTIONS.length;
  const multiCount = course
    ? course.validation.multipleChoiceCount
    : QUESTIONS.filter((q) => q.interaction.type === 'multiple_choice').length;

  return {
    all: `Toàn bộ ngân hàng (${total} câu)`,
    unanswered: 'Chưa trả lời',
    answered: 'Đã trả lời',
    wrong_latest: 'Đang sai (lượt gần nhất)',
    wrong_ever: 'Từng trả lời sai',
    correct_latest: 'Đã trả lời đúng',
    bookmarked: 'Câu đánh dấu',
    due: 'Đến hạn ôn tập',
    viewed_unanswered: 'Đã xem nhưng chưa làm',
    multiple_choice: `Câu chọn nhiều đáp án (${multiCount} câu)`,
    has_note: 'Có ghi chú cá nhân',
  };
}

export const FILTER_LABELS: Record<QuestionFilterType, string> = getFilterLabels();

/**
 * Shuffles an array of question IDs without mutating the original array.
 * Note: We only shuffle question order; option order (A, B, C, D, E) is preserved
 * so explanation references to "Option A/B/C" remain 100% accurate.
 */
export function shuffleQuestionIds(ids: readonly string[], randomFn: () => number = Math.random): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export function getFilteredPool(
  stats: AggregateStats,
  filterType: QuestionFilterType,
  derivedTag = 'all',
  questions: Question[] = QUESTIONS
): Question[] {
  return filterQuestions(questions, stats, {
    filterType,
    derivedTag,
  });
}

export interface CreateSessionParams {
  mode: StudyMode;
  title?: string;
  filterLabel?: string;
  filterType: QuestionFilterType;
  derivedTag?: string;
  requestedCount: number;
  shuffleQuestions: boolean;
  durationMinutes?: number | null;
  targetScorePercent?: number | null;
  customQuestionIds?: string[];
  questions?: Question[];
  course?: CourseBundle;
  now?: Date;
  randomFn?: () => number;
}

export interface CreateSessionResult {
  session: ActiveSession | null;
  availableCount: number;
  usedCount: number;
  wasCappedToAvailable: boolean;
}

/**
 * Builds a Practice or Mock Exam session.
 * Never repeats questions to pad if available pool is smaller than requestedCount.
 */
export function createSessionFromPool(
  stats: AggregateStats,
  params: CreateSessionParams
): CreateSessionResult {
  const now = params.now ?? new Date();
  const poolQuestions = params.questions ?? params.course?.questions ?? QUESTIONS;
  const maxBankSize = Math.max(poolQuestions.length, 1);
  const filterLabels = getFilterLabels(params.course);

  const baseIds = params.customQuestionIds
    ? Array.from(
        new Set(params.customQuestionIds.filter((qId) => Boolean(ALL_QUESTIONS_BY_ID[qId])))
      )
    : getFilteredPool(stats, params.filterType, params.derivedTag, poolQuestions).map((q) => q.id);

  const availableCount = baseIds.length;
  if (availableCount === 0) {
    return {
      session: null,
      availableCount: 0,
      usedCount: 0,
      wasCappedToAvailable: false,
    };
  }

  const clampedRequested = Math.max(1, Math.min(maxBankSize, Math.floor(params.requestedCount)));
  const orderedIds = params.shuffleQuestions
    ? shuffleQuestionIds(baseIds, params.randomFn)
    : [...baseIds];

  const selectedIds = orderedIds.slice(0, Math.min(clampedRequested, availableCount));
  const usedCount = selectedIds.length;
  const wasCappedToAvailable = availableCount < clampedRequested;

  const durationMinutes =
    params.mode === 'exam' ? Math.max(1, params.durationMinutes ?? 45) : null;
  const deadline =
    durationMinutes !== null ? now.getTime() + durationMinutes * 60 * 1000 : null;

  const defaultTitle =
    params.mode === 'exam'
      ? `Thi thử (${usedCount} câu / ${durationMinutes} phút)`
      : params.mode === 'practice'
      ? `Luyện tập (${usedCount} câu — ${filterLabels[params.filterType]})`
      : `Học từng câu`;

  const resolvedFilterLabel =
    params.filterLabel ||
    (params.customQuestionIds
      ? `Gói tự chọn (${usedCount} câu)`
      : filterLabels[params.filterType] || params.filterType);

  const session: ActiveSession = {
    id: `sess_${params.mode}_${now.getTime()}`,
    mode: params.mode,
    title: params.title || defaultTitle,
    filterLabel: resolvedFilterLabel,
    questionOrder: selectedIds,
    currentQuestionId: selectedIds[0],
    selections: {},
    checkedQuestions: {},
    revealedQuestions: {},
    flaggedQuestions: {},
    startedAt: now.toISOString(),
    deadline,
    durationMinutes,
    targetScorePercent: params.mode === 'exam' ? (params.targetScorePercent ?? 80) : null,
    submittedAt: null,
    status: 'in_progress',
  };

  return {
    session,
    availableCount,
    usedCount,
    wasCappedToAvailable,
  };
}

/**
 * Calculates remaining seconds from absolute deadline timestamp using Date.now().
 * Returns null if session has no deadline.
 */
export function getRemainingSeconds(deadline: number | null, nowMs: number = Date.now()): number | null {
  if (deadline === null || !Number.isFinite(deadline)) return null;
  const diffMs = deadline - nowMs;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 1000);
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
