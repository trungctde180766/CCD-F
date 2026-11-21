import { extractQuestionFullText, QUESTIONS } from '../data/questionBank';
import type {
  AppProgressState,
  AttemptRecord,
  Question,
  QuestionFilterType,
  SRSItemState,
} from '../types';
import { calculateSafePercentage } from './scoring';
import { isQuestionDueForReview } from './srs';

export interface QuestionProgressMeta {
  questionId: string;
  isViewed: boolean;
  isViewedOnly: boolean;
  isAnswered: boolean;
  attemptsCount: number;
  firstAttempt: AttemptRecord | null;
  latestAttempt: AttemptRecord | null;
  isFirstAttemptCorrectUnassisted: boolean;
  isLatestAttemptCorrectUnassisted: boolean;
  isLatestAttemptAssisted: boolean;
  isCurrentlyWrong: boolean;
  wasEverWrong: boolean;
  isRecoveredFromWrong: boolean;
  isBookmarked: boolean;
  hasNote: boolean;
  noteText: string;
  srs: SRSItemState | null;
  isDueForReview: boolean;
}

export interface AggregateStats {
  totalQuestions: number;
  unansweredCount: number;
  answeredCount: number;
  viewedTotalCount: number;
  viewedOnlyCount: number;
  correctUnassistedLatestCount: number;
  correctAssistedLatestCount: number;
  wrongLatestCount: number;
  everWrongCount: number;
  recoveredFromWrongCount: number;
  firstAttemptCorrectCount: number;
  /** Percentage (0..100) or null if answeredCount === 0 */
  firstAttemptAccuracyPercent: number | null;
  /** Percentage (0..100) or null if answeredCount === 0 */
  latestAttemptAccuracyPercent: number | null;
  bookmarkedCount: number;
  notesCount: number;
  dueForReviewCount: number;
  totalAttemptsCount: number;
  perQuestion: Record<string, QuestionProgressMeta>;
  byDerivedTag: Array<{
    tag: string;
    total: number;
    answered: number;
    correctLatest: number;
    accuracyPercent: number | null;
  }>;
}

export function computeAggregateStats(
  state: AppProgressState,
  now: Date | number | string = new Date()
): AggregateStats {
  const attemptsByQuestion = new Map<string, AttemptRecord[]>();
  for (const att of state.attempts) {
    const list = attemptsByQuestion.get(att.questionId);
    if (list) {
      list.push(att);
    } else {
      attemptsByQuestion.set(att.questionId, [att]);
    }
  }

  const perQuestion: Record<string, QuestionProgressMeta> = {};

  let unansweredCount = 0;
  let answeredCount = 0;
  let viewedTotalCount = 0;
  let viewedOnlyCount = 0;
  let correctUnassistedLatestCount = 0;
  let correctAssistedLatestCount = 0;
  let wrongLatestCount = 0;
  let everWrongCount = 0;
  let recoveredFromWrongCount = 0;
  let firstAttemptCorrectCount = 0;
  let bookmarkedCount = 0;
  let notesCount = 0;
  let dueForReviewCount = 0;

  const tagMap = new Map<string, { total: number; answered: number; correctLatest: number }>();

  for (const q of QUESTIONS) {
    const qAttempts = attemptsByQuestion.get(q.id) || [];
    const isAnswered = qAttempts.length > 0;
    const isViewed = Boolean(state.viewedQuestions[q.id]) || isAnswered;
    const isViewedOnly = isViewed && !isAnswered;

    const firstAttempt = isAnswered ? qAttempts[0] : null;
    const latestAttempt = isAnswered ? qAttempts[qAttempts.length - 1] : null;

    const isFirstAttemptCorrectUnassisted = Boolean(
      firstAttempt && firstAttempt.isCorrect && !firstAttempt.revealedBeforeCheck
    );
    const isLatestAttemptCorrectUnassisted = Boolean(
      latestAttempt && latestAttempt.isCorrect && !latestAttempt.revealedBeforeCheck
    );
    const isLatestAttemptAssisted = Boolean(
      latestAttempt && latestAttempt.isCorrect && latestAttempt.revealedBeforeCheck
    );

    const isCurrentlyWrong = Boolean(
      latestAttempt && (!latestAttempt.isCorrect || latestAttempt.revealedBeforeCheck)
    );
    const wasEverWrong = qAttempts.some((a) => !a.isCorrect || a.revealedBeforeCheck);
    const isRecoveredFromWrong = wasEverWrong && isLatestAttemptCorrectUnassisted;

    const isBookmarked = Boolean(state.bookmarks[q.id]);
    const noteText = state.notes[q.id] || '';
    const hasNote = Boolean(noteText.trim());
    const srs = state.srs[q.id] || null;
    const isDue = isQuestionDueForReview(srs || undefined, now);

    if (isAnswered) {
      answeredCount++;
    } else {
      unansweredCount++;
    }
    if (isViewed) viewedTotalCount++;
    if (isViewedOnly) viewedOnlyCount++;
    if (isFirstAttemptCorrectUnassisted) firstAttemptCorrectCount++;
    if (isLatestAttemptCorrectUnassisted) correctUnassistedLatestCount++;
    if (isLatestAttemptAssisted) correctAssistedLatestCount++;
    if (isCurrentlyWrong) wrongLatestCount++;
    if (wasEverWrong) everWrongCount++;
    if (isRecoveredFromWrong) recoveredFromWrongCount++;
    if (isBookmarked) bookmarkedCount++;
    if (hasNote) notesCount++;
    if (isDue) dueForReviewCount++;

    perQuestion[q.id] = {
      questionId: q.id,
      isViewed,
      isViewedOnly,
      isAnswered,
      attemptsCount: qAttempts.length,
      firstAttempt,
      latestAttempt,
      isFirstAttemptCorrectUnassisted,
      isLatestAttemptCorrectUnassisted,
      isLatestAttemptAssisted,
      isCurrentlyWrong,
      wasEverWrong,
      isRecoveredFromWrong,
      isBookmarked,
      hasNote,
      noteText,
      srs,
      isDueForReview: isDue,
    };

    for (const tag of q.derivedTags || []) {
      const entry = tagMap.get(tag) || { total: 0, answered: 0, correctLatest: 0 };
      entry.total++;
      if (isAnswered) entry.answered++;
      if (isLatestAttemptCorrectUnassisted) entry.correctLatest++;
      tagMap.set(tag, entry);
    }
  }

  const byDerivedTag = Array.from(tagMap.entries())
    .map(([tag, counts]) => ({
      tag,
      total: counts.total,
      answered: counts.answered,
      correctLatest: counts.correctLatest,
      accuracyPercent: calculateSafePercentage(counts.correctLatest, counts.answered),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalQuestions: QUESTIONS.length,
    unansweredCount,
    answeredCount,
    viewedTotalCount,
    viewedOnlyCount,
    correctUnassistedLatestCount,
    correctAssistedLatestCount,
    wrongLatestCount,
    everWrongCount,
    recoveredFromWrongCount,
    firstAttemptCorrectCount,
    firstAttemptAccuracyPercent: calculateSafePercentage(firstAttemptCorrectCount, answeredCount),
    latestAttemptAccuracyPercent: calculateSafePercentage(
      correctUnassistedLatestCount,
      answeredCount
    ),
    bookmarkedCount,
    notesCount,
    dueForReviewCount,
    totalAttemptsCount: state.attempts.length,
    perQuestion,
    byDerivedTag,
  };
}

export function filterQuestions(
  questions: Question[],
  stats: AggregateStats,
  options: {
    filterType?: QuestionFilterType;
    searchQuery?: string;
    derivedTag?: string;
    searchIncludeExplanations?: boolean;
  }
): Question[] {
  const filterType = options.filterType ?? 'all';
  const query = (options.searchQuery ?? '').trim().toLowerCase();
  const tag = options.derivedTag ?? 'all';

  return questions.filter((q) => {
    const meta = stats.perQuestion[q.id];
    if (!meta) return false;

    switch (filterType) {
      case 'unanswered':
        if (meta.isAnswered) return false;
        break;
      case 'answered':
        if (!meta.isAnswered) return false;
        break;
      case 'wrong_latest':
        if (!meta.isCurrentlyWrong) return false;
        break;
      case 'wrong_ever':
        if (!meta.wasEverWrong) return false;
        break;
      case 'correct_latest':
        if (!meta.isLatestAttemptCorrectUnassisted) return false;
        break;
      case 'bookmarked':
        if (!meta.isBookmarked) return false;
        break;
      case 'due':
        if (!meta.isDueForReview) return false;
        break;
      case 'viewed_unanswered':
        if (!meta.isViewedOnly) return false;
        break;
      case 'multiple_choice':
        if (q.interaction.type !== 'multiple_choice') return false;
        break;
      case 'has_note':
        if (!meta.hasNote) return false;
        break;
      case 'all':
      default:
        break;
    }

    if (tag !== 'all' && !(q.derivedTags || []).includes(tag)) {
      return false;
    }

    if (query) {
      const noteText = meta.noteText || '';
      const fullText = `${extractQuestionFullText(q)}\n${noteText}`.toLowerCase();
      if (!fullText.includes(query)) {
        return false;
      }
    }

    return true;
  });
}
