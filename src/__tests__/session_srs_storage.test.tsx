import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QUESTIONS, QUESTIONS_BY_ID } from '../data/questionBank';
import { BlockRenderer } from '../components/BlockRenderer';
import { QuestionCard } from '../components/QuestionCard';
import {
  computeNextSRSState,
  getHoChiMinhDateString,
  isQuestionDueForReview,
} from '../lib/srs';
import {
  applyBackupImport,
  createInitialProgressState,
  exportBackupPayload,
  loadProgressState,
  markQuestionViewed,
  recordSingleQuestionAttempt,
  saveProgressState,
  submitActiveSessionIdempotent,
  toggleQuestionBookmark,
  updateQuestionNote,
  validateAndPreviewBackupJson,
} from '../lib/storage';
import { computeAggregateStats, filterQuestions } from '../lib/stats';
import { createSessionFromPool, getRemainingSeconds } from '../lib/session';

describe('BlockRenderer & Anti-Spoiler DOM Guarantees', () => {
  it('renders paragraph, heading, and list blocks and long explanations at the end of the bank without [object Object]', () => {
    const q002 = QUESTIONS_BY_ID['ccdv-f-q002']; // has heading "Learn more" + list
    const q108 = QUESTIONS_BY_ID['ccdv-f-q108']; // long explanation + optionExplanations
    const q110 = QUESTIONS_BY_ID['ccdv-f-q110'];

    const { container } = render(
      <div>
        <BlockRenderer blocks={q002.explanation} />
        <BlockRenderer blocks={q108.explanation} />
        <BlockRenderer blocks={q110.explanation} />
      </div>
    );

    expect(container.textContent).toContain('Learn more');
    expect(container.textContent).toContain('Claude Code SDK — Authentication');
    expect(container.textContent).not.toContain('[object Object]');
    // Learn more item without URL in source must NOT be turned into a guessed <a> link
    expect(container.querySelectorAll('a').length).toBe(0);
  });

  it('hides correct answers and explanations completely from the DOM before checking or exam submission', () => {
    const q001 = QUESTIONS_BY_ID['ccdv-f-q001'];
    const { container, rerender } = render(
      <QuestionCard
        question={q001}
        mode="exam"
        selectedOptionIds={['a']}
        isSubmittedOrRevealed={false}
        isLocked={false}
        isBookmarked={false}
        noteText=""
        onSelectOption={() => {}}
        onToggleBookmark={() => {}}
        onSaveNote={() => {}}
      />
    );

    // Before submission, explanation text and "Đáp án đúng" must not exist anywhere in DOM
    expect(container.textContent).not.toContain('Giải thích chi tiết');
    expect(container.textContent).not.toContain('Đáp án đúng là C');
    expect(container.textContent).not.toContain('Đáp án đúng theo nguồn');
    expect(container.innerHTML).not.toContain('emerald-500');

    // After submission, explanation is shown exclusively in Vietnamese (no English explanation)
    rerender(
      <QuestionCard
        question={q001}
        mode="exam"
        selectedOptionIds={['a']}
        isSubmittedOrRevealed={true}
        isLocked={true}
        isBookmarked={false}
        noteText=""
        onSelectOption={() => {}}
        onToggleBookmark={() => {}}
        onSaveNote={() => {}}
      />
    );

    expect(container.textContent).toContain('Giải thích chi tiết');
    expect(container.textContent).toContain('Đáp án đúng là C');
    expect(container.textContent).toContain('Đáp án đúng theo nguồn');
    expect(container.textContent).not.toContain('Correct answer from the source');
  });
});

describe('Spaced Repetition (SRS) & Asia/Ho_Chi_Minh Day Boundary', () => {
  it('handles Asia/Ho_Chi_Minh (+07:00) day boundaries accurately across UTC midnight', () => {
    // 2026-11-21T18:30:00Z is 2026-11-22 01:30:00 in Asia/Ho_Chi_Minh (+07:00)
    const lateUtc = new Date('2026-11-21T18:30:00.000Z');
    expect(getHoChiMinhDateString(lateUtc)).toBe('2026-11-22');

    // 2026-11-21T16:59:00Z is 2026-11-21 23:59:00 in Asia/Ho_Chi_Minh (+07:00)
    const beforeMidnightHCM = new Date('2026-11-21T16:59:00.000Z');
    expect(getHoChiMinhDateString(beforeMidnightHCM)).toBe('2026-11-21');
  });

  it('progresses through 1, 3, 7, 14, 30 days on unassisted correct answers, resets on wrong, and does not advance on reveal', () => {
    const baseNow = new Date('2026-11-21T08:00:00.000Z'); // 2026-11-21 in HCM
    let srs = computeNextSRSState('ccdv-f-q001', undefined, {
      isCorrect: true,
      revealedBeforeCheck: false,
      now: baseNow,
    });
    expect(srs.streak).toBe(1);
    expect(srs.intervalDays).toBe(1);
    expect(srs.dueDate).toBe('2026-11-22');

    // 2nd unassisted correct -> 3 days
    srs = computeNextSRSState('ccdv-f-q001', srs, {
      isCorrect: true,
      revealedBeforeCheck: false,
      now: baseNow,
    });
    expect(srs.streak).toBe(2);
    expect(srs.intervalDays).toBe(3);
    expect(srs.dueDate).toBe('2026-11-24');

    // 3rd unassisted correct -> 7 days
    srs = computeNextSRSState('ccdv-f-q001', srs, {
      isCorrect: true,
      revealedBeforeCheck: false,
      now: baseNow,
    });
    expect(srs.streak).toBe(3);
    expect(srs.intervalDays).toBe(7);

    // Reveal before check -> does NOT increase streak!
    const afterReveal = computeNextSRSState('ccdv-f-q001', srs, {
      isCorrect: true,
      revealedBeforeCheck: true,
      now: baseNow,
    });
    expect(afterReveal.streak).toBe(3);
    expect(afterReveal.lastOutcome).toBe('revealed');

    // Wrong answer -> resets streak to 0 and due tomorrow (+1 day)
    const afterWrong = computeNextSRSState('ccdv-f-q001', afterReveal, {
      isCorrect: false,
      revealedBeforeCheck: false,
      now: baseNow,
    });
    expect(afterWrong.streak).toBe(0);
    expect(afterWrong.intervalDays).toBe(1);
    expect(afterWrong.dueDate).toBe('2026-11-22');

    expect(isQuestionDueForReview(afterWrong, new Date('2026-11-21T10:00:00Z'))).toBe(false);
    expect(isQuestionDueForReview(afterWrong, new Date('2026-11-22T02:00:00Z'))).toBe(true);
  });
});

describe('Session Persistence, Timer Reload, Timeout Auto-Submit, Idempotency & Backup', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('distinguishes viewed vs answered vs answered correctly, and bookmark/note edits do not create attempts', () => {
    let state = createInitialProgressState();
    const emptyStats = computeAggregateStats(state);
    expect(emptyStats.answeredCount).toBe(0);
    expect(emptyStats.firstAttemptAccuracyPercent).toBeNull();
    expect(emptyStats.latestAttemptAccuracyPercent).toBeNull();

    // Viewing a question, bookmarking, and saving a note must NOT count as answered
    state = markQuestionViewed(state, 'ccdv-f-q001');
    state = toggleQuestionBookmark(state, 'ccdv-f-q001');
    state = updateQuestionNote(state, 'ccdv-f-q001', 'Note for Q1');

    const afterViewStats = computeAggregateStats(state);
    expect(afterViewStats.viewedTotalCount).toBe(1);
    expect(afterViewStats.viewedOnlyCount).toBe(1);
    expect(afterViewStats.answeredCount).toBe(0);
    expect(state.attempts.length).toBe(0);
  });

  it('persists exam session across reload, preserves absolute deadline timer, and submits idempotently without duplicating attempts', () => {
    let state = createInitialProgressState();
    const stats = computeAggregateStats(state);
    const startTime = new Date('2026-11-21T10:00:00.000Z');

    const { session } = createSessionFromPool(stats, {
      mode: 'exam',
      filterType: 'all',
      requestedCount: 5,
      shuffleQuestions: false,
      durationMinutes: 45,
      targetScorePercent: 80,
      now: startTime,
    });
    expect(session).not.toBeNull();

    state = {
      ...state,
      activeSession: {
        ...session!,
        currentQuestionId: 'ccdv-f-q002',
        selections: {
          'ccdv-f-q001': ['c'], // correct
          'ccdv-f-q002': ['a'], // wrong (correct is b)
          // q003, q004, q005 left blank -> graded as wrong on submit
        },
      },
    };
    saveProgressState(state);

    // Simulate reload 15 minutes later
    const reloaded = loadProgressState().state;
    expect(reloaded.activeSession?.currentQuestionId).toBe('ccdv-f-q002');
    expect(reloaded.activeSession?.selections['ccdv-f-q001']).toEqual(['c']);

    const fifteenMinLaterMs = startTime.getTime() + 15 * 60 * 1000;
    const remainingSec = getRemainingSeconds(reloaded.activeSession!.deadline, fifteenMinLaterMs);
    expect(remainingSec).toBe(30 * 60); // 30 minutes left, not reset to 45!

    // Submit once (e.g. on timeout)
    const firstSubmit = submitActiveSessionIdempotent(reloaded, {
      autoSubmittedByTimeout: true,
      now: new Date(startTime.getTime() + 45 * 60 * 1000),
    });
    expect(firstSubmit.historyItem).not.toBeNull();
    expect(firstSubmit.historyItem?.totalQuestions).toBe(5);
    expect(firstSubmit.historyItem?.answeredCount).toBe(2);
    expect(firstSubmit.historyItem?.correctCount).toBe(1); // Only q001 is correct; unanswered q003..q005 are wrong
    expect(firstSubmit.nextState.attempts.length).toBe(5);
    expect(firstSubmit.nextState.sessionHistory.length).toBe(1);

    // Submit a second time (double click or reload after submit) -> idempotent, must NOT duplicate attempts or history!
    const secondSubmit = submitActiveSessionIdempotent(firstSubmit.nextState);
    expect(secondSubmit.nextState.attempts.length).toBe(5);
    expect(secondSubmit.nextState.sessionHistory.length).toBe(1);
  });

  it('caps session question count to available filtered pool without duplicating questions and handles empty filters', () => {
    let state = createInitialProgressState();
    state = toggleQuestionBookmark(state, 'ccdv-f-q001');
    state = toggleQuestionBookmark(state, 'ccdv-f-q005');

    const stats = computeAggregateStats(state);
    const res = createSessionFromPool(stats, {
      mode: 'practice',
      filterType: 'bookmarked',
      requestedCount: 20,
      shuffleQuestions: false,
    });

    expect(res.availableCount).toBe(2);
    expect(res.usedCount).toBe(2);
    expect(res.wasCappedToAvailable).toBe(true);
    expect(res.session?.questionOrder).toEqual(['ccdv-f-q001', 'ccdv-f-q005']);

    // Empty filter (no wrong answers yet)
    const emptyFilterList = filterQuestions(QUESTIONS, stats, {
      filterType: 'wrong_latest',
    });
    expect(emptyFilterList).toEqual([]);
  });

  it('exports and re-imports backup JSON, and rejects corrupted JSON while keeping existing progress intact', () => {
    let state = createInitialProgressState();
    state = toggleQuestionBookmark(state, 'ccdv-f-q010');
    state = updateQuestionNote(state, 'ccdv-f-q010', 'Important note on Q10');
    state = recordSingleQuestionAttempt(state, {
      questionId: 'ccdv-f-q001',
      selectedOptionIds: ['c'],
      sessionId: 'study_1',
      mode: 'study',
      revealedBeforeCheck: false,
    }).nextState;

    const exported = exportBackupPayload(state);
    const jsonStr = JSON.stringify(exported);

    // Validate valid backup
    const preview = validateAndPreviewBackupJson(jsonStr);
    expect(preview.isValid).toBe(true);
    expect(preview.counts?.answeredQuestionsCount).toBe(1);
    expect(preview.counts?.bookmarksCount).toBe(1);
    expect(preview.counts?.notesCount).toBe(1);

    // Reject corrupted JSON without touching state
    const badJsonPreview = validateAndPreviewBackupJson('{ corrupted json ');
    expect(badJsonPreview.isValid).toBe(false);
    expect(state.attempts.length).toBe(1);
    expect(state.notes['ccdv-f-q010']).toBe('Important note on Q10');

    // Reject wrong courseId
    const wrongCoursePreview = validateAndPreviewBackupJson(
      JSON.stringify({ ...exported, courseId: 'other-course' })
    );
    expect(wrongCoursePreview.isValid).toBe(false);

    // Re-import into a fresh state using replace mode
    const freshState = createInitialProgressState();
    const restored = applyBackupImport(freshState, preview.payload!, 'replace');
    expect(restored.attempts.length).toBe(1);
    expect(restored.bookmarks['ccdv-f-q010']).toBe(true);
    expect(restored.notes['ccdv-f-q010']).toBe('Important note on Q10');
  });
});
