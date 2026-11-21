import type { Question } from '../types';

export interface GradeDetail {
  isCorrect: boolean;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  missingOptionIds: string[];
  extraOptionIds: string[];
  isUnanswered: boolean;
}

/**
 * Normalizes an array of option IDs: trims strings, removes duplicates, preserves set semantics.
 */
export function normalizeOptionIds(ids: readonly string[] | undefined | null): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Pure set comparison for option IDs (order-independent).
 * Both single_choice and multiple_choice require exact set equality:
 * - No missing correct options
 * - No extra incorrect options
 * - No partial credit in primary score
 */
export function compareOptionSets(
  selectedIds: readonly string[],
  correctIds: readonly string[]
): GradeDetail {
  const normalizedSelected = normalizeOptionIds(selectedIds);
  const normalizedCorrect = normalizeOptionIds(correctIds);

  const selectedSet = new Set(normalizedSelected);
  const correctSet = new Set(normalizedCorrect);

  const missingOptionIds = normalizedCorrect.filter((id) => !selectedSet.has(id));
  const extraOptionIds = normalizedSelected.filter((id) => !correctSet.has(id));

  const isCorrect =
    normalizedCorrect.length > 0 &&
    normalizedSelected.length === normalizedCorrect.length &&
    missingOptionIds.length === 0 &&
    extraOptionIds.length === 0;

  return {
    isCorrect,
    selectedOptionIds: normalizedSelected,
    correctOptionIds: normalizedCorrect,
    missingOptionIds,
    extraOptionIds,
    isUnanswered: normalizedSelected.length === 0,
  };
}

/**
 * Grades a question against user-selected option IDs.
 * - For single_choice: requires exactly 1 selected ID equal to the single correct ID.
 * - For multiple_choice: order-independent set comparison; must match all correct IDs with no extras.
 */
export function gradeQuestion(
  question: Pick<Question, 'interaction'>,
  selectedOptionIds: readonly string[]
): GradeDetail {
  const detail = compareOptionSets(selectedOptionIds, question.interaction.correctOptionIds);

  if (question.interaction.type === 'single_choice') {
    const singleCorrect =
      detail.selectedOptionIds.length === 1 &&
      detail.correctOptionIds.length === 1 &&
      detail.selectedOptionIds[0] === detail.correctOptionIds[0];
    return {
      ...detail,
      isCorrect: singleCorrect,
    };
  }

  return detail;
}

/**
 * Safe percentage calculator that never returns NaN or Infinity.
 * Returns null when denominator <= 0.
 */
export function calculateSafePercentage(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}
