import type { SRSItemState } from '../types';

export const SRS_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const SRS_INTERVAL_STEPS = [1, 3, 7, 14, 30] as const;

/**
 * Converts a Date or timestamp to YYYY-MM-DD in Asia/Ho_Chi_Minh timezone.
 */
export function getHoChiMinhDateString(dateInput: Date | number | string = new Date()): string {
  const date =
    typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SRS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Adds a whole number of calendar days to a YYYY-MM-DD date string.
 */
export function addCalendarDays(ymd: string, daysToAdd: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d + daysToAdd));
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes next SRS state after an attempt or answer reveal:
 * - Wrong answer: streak resets to 0, due tomorrow (+1 day in Asia/Ho_Chi_Minh).
 * - Revealed answer before checking (assisted): streak does NOT increase; if no prior state or previously wrong, due tomorrow (+1 day); otherwise keeps current streak and schedules by current interval (min 1 day).
 * - Unassisted correct answer: advances streak step through [1, 3, 7, 14, 30] days.
 */
export function computeNextSRSState(
  questionId: string,
  prevState: SRSItemState | undefined,
  params: {
    isCorrect: boolean;
    revealedBeforeCheck: boolean;
    now?: Date | number | string;
  }
): SRSItemState {
  const nowDate = params.now !== undefined ? new Date(params.now) : new Date();
  const todayHCM = getHoChiMinhDateString(nowDate);
  const nowIso = nowDate.toISOString();

  if (params.revealedBeforeCheck) {
    const preservedStreak = prevState ? prevState.streak : 0;
    const intervalDays = 1;
    return {
      questionId,
      streak: preservedStreak,
      intervalDays,
      dueDate: addCalendarDays(todayHCM, intervalDays),
      lastReviewedAt: nowIso,
      lastOutcome: 'revealed',
    };
  }

  if (!params.isCorrect) {
    return {
      questionId,
      streak: 0,
      intervalDays: 1,
      dueDate: addCalendarDays(todayHCM, 1),
      lastReviewedAt: nowIso,
      lastOutcome: 'wrong',
    };
  }

  // Unassisted correct answer: advance streak through [1, 3, 7, 14, 30]
  const currentStreak = prevState?.streak ?? 0;
  const nextStreak = currentStreak + 1;
  const stepIndex = Math.min(nextStreak - 1, SRS_INTERVAL_STEPS.length - 1);
  const intervalDays = SRS_INTERVAL_STEPS[stepIndex];

  return {
    questionId,
    streak: nextStreak,
    intervalDays,
    dueDate: addCalendarDays(todayHCM, intervalDays),
    lastReviewedAt: nowIso,
    lastOutcome: 'correct_unassisted',
  };
}

/**
 * Checks whether an SRS item is due on or before the current date in Asia/Ho_Chi_Minh.
 */
export function isQuestionDueForReview(
  srsItem: SRSItemState | undefined,
  now: Date | number | string = new Date()
): boolean {
  if (!srsItem || !srsItem.dueDate) return false;
  const todayHCM = getHoChiMinhDateString(now);
  return srsItem.dueDate <= todayHCM;
}
