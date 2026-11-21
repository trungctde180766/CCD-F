import { describe, expect, it } from 'vitest';
import { QUESTIONS_BY_ID } from '../data/questionBank';
import {
  calculateSafePercentage,
  compareOptionSets,
  gradeQuestion,
} from '../lib/scoring';

describe('Scoring & Option Set Comparison', () => {
  it('compares option sets correctly: exact match, reversed order, missing, extra, wrong', () => {
    // Exact match in order
    expect(compareOptionSets(['a', 'b', 'e'], ['a', 'b', 'e']).isCorrect).toBe(true);

    // Reversed / shuffled order
    const shuffled = compareOptionSets(['e', 'a', 'b'], ['a', 'b', 'e']);
    expect(shuffled.isCorrect).toBe(true);
    expect(shuffled.missingOptionIds).toEqual([]);
    expect(shuffled.extraOptionIds).toEqual([]);

    // Missing one correct option (partial selection -> must be false!)
    const partial = compareOptionSets(['a', 'b'], ['a', 'b', 'e']);
    expect(partial.isCorrect).toBe(false);
    expect(partial.missingOptionIds).toEqual(['e']);
    expect(partial.extraOptionIds).toEqual([]);

    // Extra incorrect option selected
    const extra = compareOptionSets(['a', 'b', 'c', 'e'], ['a', 'b', 'e']);
    expect(extra.isCorrect).toBe(false);
    expect(extra.missingOptionIds).toEqual([]);
    expect(extra.extraOptionIds).toEqual(['c']);

    // Completely wrong
    const wrong = compareOptionSets(['c', 'd'], ['a', 'b', 'e']);
    expect(wrong.isCorrect).toBe(false);
    expect(wrong.missingOptionIds).toEqual(['a', 'b', 'e']);
    expect(wrong.extraOptionIds).toEqual(['c', 'd']);

    // Empty / unanswered
    const empty = compareOptionSets([], ['a', 'c']);
    expect(empty.isCorrect).toBe(false);
    expect(empty.isUnanswered).toBe(true);
  });

  it('grades real question ccdv-f-q078 (multiple_choice: A, C) accurately', () => {
    const q078 = QUESTIONS_BY_ID['ccdv-f-q078'];
    expect(q078.interaction.type).toBe('multiple_choice');

    expect(gradeQuestion(q078, ['a', 'c']).isCorrect).toBe(true);
    expect(gradeQuestion(q078, ['c', 'a']).isCorrect).toBe(true);
    expect(gradeQuestion(q078, ['a']).isCorrect).toBe(false);
    expect(gradeQuestion(q078, ['c']).isCorrect).toBe(false);
    expect(gradeQuestion(q078, ['a', 'b', 'c']).isCorrect).toBe(false);
    expect(gradeQuestion(q078, []).isCorrect).toBe(false);
  });

  it('grades real question ccdv-f-q103 (multiple_choice: A, B, E) accurately', () => {
    const q103 = QUESTIONS_BY_ID['ccdv-f-q103'];
    expect(q103.interaction.type).toBe('multiple_choice');

    expect(gradeQuestion(q103, ['a', 'b', 'e']).isCorrect).toBe(true);
    expect(gradeQuestion(q103, ['e', 'b', 'a']).isCorrect).toBe(true);
    expect(gradeQuestion(q103, ['a', 'b']).isCorrect).toBe(false);
    expect(gradeQuestion(q103, ['a', 'b', 'd', 'e']).isCorrect).toBe(false);
  });

  it('grades real single_choice questions ccdv-f-q001 (C) and ccdv-f-q110 (A)', () => {
    const q001 = QUESTIONS_BY_ID['ccdv-f-q001'];
    const q110 = QUESTIONS_BY_ID['ccdv-f-q110'];

    expect(gradeQuestion(q001, ['c']).isCorrect).toBe(true);
    expect(gradeQuestion(q001, ['a']).isCorrect).toBe(false);
    expect(gradeQuestion(q001, ['c', 'a']).isCorrect).toBe(false);

    expect(gradeQuestion(q110, ['a']).isCorrect).toBe(true);
    expect(gradeQuestion(q110, ['b']).isCorrect).toBe(false);
  });

  it('never returns NaN or Infinity when calculating percentages with zero denominator', () => {
    expect(calculateSafePercentage(0, 0)).toBeNull();
    expect(calculateSafePercentage(5, 0)).toBeNull();
    expect(calculateSafePercentage(8, 10)).toBe(80);
  });
});
