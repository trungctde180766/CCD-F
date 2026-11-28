import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { BlockRenderer } from '../components/BlockRenderer';
import { QuestionCard } from '../components/QuestionCard';
import {
  ASSOCIATE_COURSE,
  DERIVED_TAG_RULES,
  DEVELOPER_COURSE,
  validateQuestionBank,
} from '../data/questionBank';
import { saveStoredAuthSession } from '../lib/auth';
import { gradeQuestion } from '../lib/scoring';
import { createSessionFromPool } from '../lib/session';
import { computeAggregateStats, filterQuestions } from '../lib/stats';
import {
  applyBackupImport,
  createInitialProgressState,
  exportBackupPayload,
  getStorageKeyForUser,
  loadProgressState,
  recordSingleQuestionAttempt,
  saveProgressState,
  submitActiveSessionIdempotent,
  validateAndPreviewBackupJson,
} from '../lib/storage';

describe('Claude Certified Associate – Foundations (CCAO-F) Dataset & Validation', () => {
  it('imports all 169 real Associate questions (127 single_choice, 42 multiple_choice) with valid ccao-f-q001..q169 IDs', () => {
    const report = validateQuestionBank(ASSOCIATE_COURSE.bank);
    expect(report.isValid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.totalQuestions).toBe(169);
    expect(report.uniqueIdsCount).toBe(169);
    expect(report.singleChoiceCount).toBe(127);
    expect(report.multipleChoiceCount).toBe(42);
    expect(report.unresolvedReferencesCount).toBe(0);

    expect(ASSOCIATE_COURSE.bank.id).toBe('ccao-f');
    expect(ASSOCIATE_COURSE.bank.revision).toBe(3);
    expect(ASSOCIATE_COURSE.questions[0].id).toBe('ccao-f-q001');
    expect(ASSOCIATE_COURSE.questions[168].id).toBe('ccao-f-q169');

    // Developer bank remains completely untouched
    expect(DEVELOPER_COURSE.questions.length).toBe(110);
    expect(DEVELOPER_COURSE.validation.isValid).toBe(true);
  });

  it('never assigns Developer programming tags to Associate business workflow questions', () => {
    const devOnlyTags = new Set(DERIVED_TAG_RULES.map((r) => r.tag));
    for (const q of ASSOCIATE_COURSE.questions) {
      expect(q.topicId).toBe('claude-associate-foundations');
      expect((q.derivedTags || []).length).toBeGreaterThan(0);
      for (const tag of q.derivedTags || []) {
        expect(devOnlyTags.has(tag)).toBe(false);
      }
    }
  });

  it('grades real Associate questions accurately using generalized set equality (q001, q014, q105, q169)', () => {
    const q001 = ASSOCIATE_COURSE.questionsById['ccao-f-q001'];
    expect(q001.interaction.type).toBe('single_choice');
    expect(q001.interaction.correctOptionIds).toEqual(['b']);
    expect(gradeQuestion(q001, ['b']).isCorrect).toBe(true);
    expect(gradeQuestion(q001, ['a']).isCorrect).toBe(false);
    expect(gradeQuestion(q001, []).isCorrect).toBe(false);

    const q014 = ASSOCIATE_COURSE.questionsById['ccao-f-q014'];
    expect(q014.interaction.type).toBe('multiple_choice');
    expect(q014.interaction.correctOptionIds).toEqual(['a', 'e']);
    expect(gradeQuestion(q014, ['a', 'e']).isCorrect).toBe(true);
    expect(gradeQuestion(q014, ['e', 'a']).isCorrect).toBe(true); // order-independent
    expect(gradeQuestion(q014, ['a']).isCorrect).toBe(false); // missing e
    expect(gradeQuestion(q014, ['a', 'e', 'b']).isCorrect).toBe(false); // extra b
    expect(gradeQuestion(q014, ['b', 'c']).isCorrect).toBe(false); // completely wrong

    const q105 = ASSOCIATE_COURSE.questionsById['ccao-f-q105'];
    expect(q105.interaction.type).toBe('single_choice');
    expect(q105.interaction.correctOptionIds).toEqual(['d']);
    const optD = q105.interaction.options.find((o) => o.id === 'd');
    expect(optD?.label).toContain('3, 5, 1, 4, 2');
    expect(gradeQuestion(q105, ['d']).isCorrect).toBe(true);
    expect(gradeQuestion(q105, ['a']).isCorrect).toBe(false);

    const q169 = ASSOCIATE_COURSE.questionsById['ccao-f-q169'];
    expect(q169.interaction.type).toBe('multiple_choice');
    expect(q169.interaction.correctOptionIds).toEqual(['a', 'c']);
    expect(gradeQuestion(q169, ['a', 'c']).isCorrect).toBe(true);
    expect(gradeQuestion(q169, ['c', 'a']).isCorrect).toBe(true);
    expect(gradeQuestion(q169, ['a']).isCorrect).toBe(false);
    expect(gradeQuestion(q169, ['a', 'c', 'd']).isCorrect).toBe(false);
  });

  it('renders paragraph, heading, list, and callout blocks verbatim (Answer keys disagree & Step numbering corrected) without [object Object] or $13', () => {
    const q014 = ASSOCIATE_COURSE.questionsById['ccao-f-q014'];
    const q096 = ASSOCIATE_COURSE.questionsById['ccao-f-q096'];
    const q105 = ASSOCIATE_COURSE.questionsById['ccao-f-q105'];
    const q114 = ASSOCIATE_COURSE.questionsById['ccao-f-q114'];
    const q169 = ASSOCIATE_COURSE.questionsById['ccao-f-q169'];

    const { container } = render(
      <div>
        <BlockRenderer blocks={q014.explanation} />
        <BlockRenderer blocks={q096.explanation} />
        <BlockRenderer blocks={q105.explanation} />
        <BlockRenderer blocks={q114.explanation} />
        <BlockRenderer blocks={q169.explanation} />
      </div>
    );

    expect(container.textContent).toContain('Answer keys disagree');
    expect(container.textContent).toContain('Step numbering corrected');
    expect(container.textContent).toContain('3, 5, 1, 4, 2');
    expect(container.textContent).not.toContain('[object Object]');
    expect(container.textContent).not.toMatch(/\$13\b/);
    // Learn more items without URLs in source must not become fabricated <a> links
    expect(container.querySelectorAll('a').length).toBe(0);
  });

  it('keeps Associate answers & explanations hidden before submit and shows verbatim English explanation + optionExplanations after submit', () => {
    const q169 = ASSOCIATE_COURSE.questionsById['ccao-f-q169'];
    const { container, rerender } = render(
      <QuestionCard
        question={q169}
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

    expect(container.textContent).not.toContain('Giải thích chi tiết');
    expect(container.textContent).not.toContain('Đáp án đúng theo nguồn');

    rerender(
      <QuestionCard
        question={q169}
        mode="exam"
        selectedOptionIds={['a', 'c']}
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
    expect(container.textContent).toContain('Nguyên văn từ nguồn • CCAO-F');
    expect(container.textContent).toContain('Giải thích riêng theo từng lựa chọn (từ nguồn)');
  });
});

describe('Multi-Course Isolation (CCDV-F vs CCAO-F), Backup Validation & UI Switching', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('isolates progress storage keys by courseId + revision and rejects cross-course backup imports without corrupting data', () => {
    const devKey = getStorageKeyForUser('learner1', 'ccdv-f');
    const assocKey = getStorageKeyForUser('learner1', 'ccao-f');
    expect(devKey).not.toBe(assocKey);
    expect(assocKey).toContain('ccao-f');
    expect(assocKey).toContain('r3');

    // Record progress in Developer (ccdv-f)
    let devState = createInitialProgressState('ccdv-f');
    devState = recordSingleQuestionAttempt(devState, {
      questionId: 'ccdv-f-q001',
      selectedOptionIds: ['c'],
      sessionId: 'dev_sess',
      mode: 'study',
      revealedBeforeCheck: false,
    }).nextState;
    saveProgressState(devState, 'learner1', 'ccdv-f');

    // Record progress in Associate (ccao-f)
    let assocState = createInitialProgressState('ccao-f');
    assocState = recordSingleQuestionAttempt(assocState, {
      questionId: 'ccao-f-q001',
      selectedOptionIds: ['b'],
      sessionId: 'assoc_sess',
      mode: 'study',
      revealedBeforeCheck: false,
    }).nextState;
    saveProgressState(assocState, 'learner1', 'ccao-f');

    // Reload both independently
    const reloadedDev = loadProgressState('learner1', 'ccdv-f').state;
    const reloadedAssoc = loadProgressState('learner1', 'ccao-f').state;
    expect(reloadedDev.attempts.map((a) => a.questionId)).toEqual(['ccdv-f-q001']);
    expect(reloadedAssoc.attempts.map((a) => a.questionId)).toEqual(['ccao-f-q001']);

    // Export Associate backup and validate
    const assocBackupJson = JSON.stringify(exportBackupPayload(reloadedAssoc));
    const validPreview = validateAndPreviewBackupJson(assocBackupJson, 'ccao-f');
    expect(validPreview.isValid).toBe(true);
    expect(validPreview.courseId).toBe('ccao-f');
    expect(validPreview.counts?.answeredQuestionsCount).toBe(1);

    // Reject importing Associate backup into Developer course
    const crossCoursePreview = validateAndPreviewBackupJson(assocBackupJson, 'ccdv-f');
    expect(crossCoursePreview.isValid).toBe(false);

    // Reject malformed JSON without corrupting existing state
    const badJsonPreview = validateAndPreviewBackupJson('{ invalid json', 'ccao-f');
    expect(badJsonPreview.isValid).toBe(false);

    // Apply valid merge
    const merged = applyBackupImport(createInitialProgressState('ccao-f'), validPreview.payload!, 'merge');
    expect(merged.attempts.length).toBe(1);
    expect(merged.attempts[0].questionId).toBe('ccao-f-q001');

    // Empty stats & empty filter safety (no NaN / Infinity)
    const emptyStats = computeAggregateStats(
      createInitialProgressState('ccao-f'),
      new Date(),
      ASSOCIATE_COURSE.questions
    );
    expect(emptyStats.totalQuestions).toBe(169);
    expect(emptyStats.firstAttemptAccuracyPercent).toBeNull();
    expect(emptyStats.latestAttemptAccuracyPercent).toBeNull();
    expect(
      filterQuestions(ASSOCIATE_COURSE.questions, emptyStats, { filterType: 'bookmarked' }).length
    ).toBe(0);

    // Idempotent exam submission on Associate (up to 169 questions)
    const sessRes = createSessionFromPool(emptyStats, {
      mode: 'exam',
      filterType: 'all',
      requestedCount: 5,
      shuffleQuestions: false,
      durationMinutes: 10,
      targetScorePercent: 80,
      questions: ASSOCIATE_COURSE.questions,
      course: ASSOCIATE_COURSE,
    });
    expect(sessRes.session?.questionOrder.length).toBe(5);
    const stateWithExam = { ...createInitialProgressState('ccao-f'), activeSession: sessRes.session };
    const sub1 = submitActiveSessionIdempotent(stateWithExam);
    const sub2 = submitActiveSessionIdempotent(sub1.nextState);
    expect(sub1.nextState.attempts.length).toBe(5);
    expect(sub2.nextState.attempts.length).toBe(5); // idempotent!
  });

  it('lets users switch seamlessly between Developer (110c) and Associate (169c) in the UI with isolated study progress', () => {
    saveStoredAuthSession({
      token: 'test-token-dual',
      user: {
        username: 'dualuser',
        displayName: 'Dual Learner',
        role: 'user',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
    });

    render(<App />);

    // Default starts on Developer (CCDV-F)
    expect(screen.getByText(/Bảng điều khiển tự học CCDV-F/i)).toBeInTheDocument();

    // Switch to Associate (CCAO-F) via header switcher
    fireEvent.click(screen.getByRole('button', { name: /Associate \(CCAO-F\) \(169c\)/i }));
    expect(screen.getByText(/Bảng điều khiển tự học CCAO-F/i)).toBeInTheDocument();
    expect(screen.getByText(/169 câu hỏi thực tế/i)).toBeInTheDocument();

    // Open Study Mode -> verify ccao-f-q001 loads
    fireEvent.click(screen.getByRole('button', { name: /Học từng câu/i }));
    expect(screen.getByText('ccao-f-q001')).toBeInTheDocument();

    // Open Exam -> switch to Custom Pack tab -> verify 169 questions available
    fireEvent.click(screen.getByRole('button', { name: /^Thi thử$/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Tự chọn câu & Gói đề/i }));
    expect(screen.getByText(/Đã chọn: 0 \/ 169 câu/i)).toBeInTheDocument();

    // Switch back to Developer (CCDV-F) -> verify 110 questions available
    fireEvent.click(screen.getByRole('button', { name: /Developer \(CCDV-F\) \(110c\)/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Tự chọn câu & Gói đề/i }));
    expect(screen.getByText(/Đã chọn: 0 \/ 110 câu/i)).toBeInTheDocument();
  });
});
