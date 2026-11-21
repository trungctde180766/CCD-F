import { describe, expect, it } from 'vitest';
import {
  DATASET_VALIDATION,
  extractQuestionFullText,
  hasUnresolvedFlightReference,
  QUESTION_BANK,
  QUESTIONS,
  QUESTIONS_BY_ID,
} from '../data/questionBank';

describe('Dataset Validation — 110 Real Questions from T-Study (ccdv-f)', () => {
  it('validates root structure and imports exactly 110 questions (102 single_choice, 8 multiple_choice)', () => {
    expect(DATASET_VALIDATION.isValid).toBe(true);
    expect(DATASET_VALIDATION.errors).toEqual([]);
    expect(DATASET_VALIDATION.totalQuestions).toBe(110);
    expect(DATASET_VALIDATION.uniqueIdsCount).toBe(110);
    expect(DATASET_VALIDATION.singleChoiceCount).toBe(102);
    expect(DATASET_VALIDATION.multipleChoiceCount).toBe(8);
    expect(DATASET_VALIDATION.unresolvedReferencesCount).toBe(0);
    expect(QUESTION_BANK.id).toBe('ccdv-f');
    expect(QUESTION_BANK.revision).toBe(2);
  });

  it('preserves full ccdv-f-q001 to ccdv-f-q110 IDs in exact order', () => {
    const ids = QUESTIONS.map((q) => q.id);
    const expectedIds = Array.from(
      { length: 110 },
      (_, i) => `ccdv-f-q${String(i + 1).padStart(3, '0')}`
    );
    expect(ids).toEqual(expectedIds);
  });

  it('matches exact answer keys for the 8 multiple_choice questions', () => {
    const expectedMultiple: Array<{ id: string; correctOptionIds: string[] }> = [
      { id: 'ccdv-f-q078', correctOptionIds: ['a', 'c'] },
      { id: 'ccdv-f-q081', correctOptionIds: ['a', 'b'] },
      { id: 'ccdv-f-q087', correctOptionIds: ['a', 'b', 'c'] },
      { id: 'ccdv-f-q092', correctOptionIds: ['a', 'b', 'd'] },
      { id: 'ccdv-f-q100', correctOptionIds: ['a', 'b', 'c'] },
      { id: 'ccdv-f-q103', correctOptionIds: ['a', 'b', 'e'] },
      { id: 'ccdv-f-q104', correctOptionIds: ['a', 'b', 'e'] },
      { id: 'ccdv-f-q106', correctOptionIds: ['a', 'b', 'c'] },
    ];
    expect(DATASET_VALIDATION.multipleChoiceQuestions).toEqual(expectedMultiple);
  });

  it('verifies q001 answer is C and q110 answer is A', () => {
    expect(QUESTIONS_BY_ID['ccdv-f-q001'].interaction.correctOptionIds).toEqual(['c']);
    expect(QUESTIONS_BY_ID['ccdv-f-q110'].interaction.correctOptionIds).toEqual(['a']);
  });

  it('contains no [object Object] or unresolved internal flight references like $13', () => {
    for (const q of QUESTIONS) {
      const fullText = extractQuestionFullText(q);
      expect(fullText).not.toContain('[object Object]');
      expect(hasUnresolvedFlightReference(q)).toBe(false);
    }
  });

  it('preserves original topicId and difficulty while storing derivedTags separately', () => {
    for (const q of QUESTIONS) {
      expect(q.topicId).toBe('claude-developer-foundations');
      expect(q.difficulty).toBe('unspecified');
      expect(Array.isArray(q.derivedTags)).toBe(true);
      expect((q.derivedTags || []).length).toBeGreaterThan(0);
    }
  });
});
