import { beforeEach, describe, expect, it } from 'vitest';
import {
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} from '../../api/index';
import {
  createInitialProgressState,
  getStorageKeyForUser,
  loadProgressState,
  recordSingleQuestionAttempt,
  saveProgressState,
} from '../lib/storage';
import { reconcileUserProgress } from '../lib/auth';

describe('Authentication, Password Hashing, JWT Tokens & Multi-User Progress Isolation', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hashes and verifies passwords accurately including admin password concatre', () => {
    const hash = hashPassword('concatre');
    expect(verifyPassword('concatre', hash)).toBe(true);
    expect(verifyPassword('wrongpass', hash)).toBe(false);
  });

  it('signs and verifies JWT token for admin user trung', () => {
    const token = signToken({
      username: 'trung',
      displayName: 'Thanh Trung (Admin)',
      role: 'admin',
    });
    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.username).toBe('trung');
    expect(decoded?.role).toBe('admin');
    expect(verifyToken(`${token}tampered`)).toBeNull();
  });

  it('isolates study progress in localStorage per username so multiple learners do not overwrite each other', () => {
    expect(getStorageKeyForUser('trung')).not.toBe(getStorageKeyForUser('hocvien01'));

    let userAState = createInitialProgressState();
    userAState = recordSingleQuestionAttempt(userAState, {
      questionId: 'ccdv-f-q001',
      selectedOptionIds: ['c'],
      sessionId: 'sess_a',
      mode: 'study',
      revealedBeforeCheck: false,
    }).nextState;
    saveProgressState(userAState, 'hocvien_a');

    let userBState = createInitialProgressState();
    userBState = recordSingleQuestionAttempt(userBState, {
      questionId: 'ccdv-f-q002',
      selectedOptionIds: ['b'],
      sessionId: 'sess_b',
      mode: 'study',
      revealedBeforeCheck: false,
    }).nextState;
    saveProgressState(userBState, 'hocvien_b');

    const loadedA = loadProgressState('hocvien_a').state;
    const loadedB = loadProgressState('hocvien_b').state;
    const loadedGuest = loadProgressState(null).state;

    expect(loadedA.attempts.map((a) => a.questionId)).toEqual(['ccdv-f-q001']);
    expect(loadedB.attempts.map((a) => a.questionId)).toEqual(['ccdv-f-q002']);
    expect(loadedGuest.attempts.length).toBe(0);
  });

  it('reconciles local user progress with MongoDB server progress without losing attempts', () => {
    let localState = createInitialProgressState();
    localState = recordSingleQuestionAttempt(localState, {
      questionId: 'ccdv-f-q001',
      selectedOptionIds: ['c'],
      sessionId: 'sess_local',
      mode: 'study',
      revealedBeforeCheck: false,
    }).nextState;

    let serverState = createInitialProgressState();
    serverState = recordSingleQuestionAttempt(serverState, {
      questionId: 'ccdv-f-q110',
      selectedOptionIds: ['a'],
      sessionId: 'sess_server',
      mode: 'study',
      revealedBeforeCheck: false,
    }).nextState;

    const merged = reconcileUserProgress(localState, serverState);
    expect(merged.attempts.length).toBe(2);
    expect(merged.attempts.map((a) => a.questionId).sort()).toEqual([
      'ccdv-f-q001',
      'ccdv-f-q110',
    ]);
  });
});
