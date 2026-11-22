import { beforeEach, describe, expect, it } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import apiHandler, {
  hashPassword,
  parseUserAgentInfo,
  signToken,
  verifyPassword,
  verifyToken,
} from '../../api/index';
import { QUESTIONS } from '../data/questionBank';
import {
  getCompletePerOptionRationales,
  getExamSmartHint,
  getVietnameseOptionTranslation,
  getVietnamesePromptSummary,
} from '../lib/bilingualAndRationale';
import {
  createInitialProgressState,
  getStorageKeyForUser,
  loadProgressState,
  recordSingleQuestionAttempt,
  saveProgressState,
} from '../lib/storage';
import { reconcileUserProgress } from '../lib/auth';

describe('Authentication, Telemetry, Bilingual EN/VI & Complete Per-Option Rationales', () => {
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

  it('parses device, OS, and browser telemetry from User-Agent strings accurately', () => {
    const winChrome = parseUserAgentInfo(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
    );
    expect(winChrome.os).toBe('Windows 10/11');
    expect(winChrome.browser).toContain('Chrome');
    expect(winChrome.deviceType).toBe('Desktop');

    const iphoneSafari = parseUserAgentInfo(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1'
    );
    expect(iphoneSafari.os).toBe('iOS / iPadOS');
    expect(iphoneSafari.deviceType).toBe('Mobile');
  });

  it('generates complete per-option rationales (why right / why wrong) in EN and VI for every option across all 110 questions', () => {
    for (const q of QUESTIONS) {
      const rationales = getCompletePerOptionRationales(q);
      expect(rationales.length).toBe(q.interaction.options.length);

      for (const rat of rationales) {
        expect(rat.englishReason.trim().length).toBeGreaterThan(10);
        expect(rat.vietnameseReason.trim().length).toBeGreaterThan(10);
        if (q.interaction.correctOptionIds.includes(rat.optionId)) {
          expect(rat.isCorrect).toBe(true);
          expect(rat.vietnameseReason).toContain('ĐÚNG');
        } else {
          expect(rat.isCorrect).toBe(false);
          expect(rat.vietnameseReason).toContain('SAI');
        }
      }

      const viPrompt = getVietnamesePromptSummary(q);
      expect(viPrompt.trim().length).toBeGreaterThan(15);

      const hint = getExamSmartHint(q);
      expect(hint.guidingPrincipleVi.length).toBeGreaterThan(10);
      expect(hint.keyClues.length).toBeGreaterThan(0);

      for (const opt of q.interaction.options) {
        expect(getVietnameseOptionTranslation(opt).trim().length).toBeGreaterThan(5);
      }
    }
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

  it('handles Vercel rewritten route query (/api/index?route=health) cleanly', async () => {
    let status = 0;
    let payload = '';
    const fakeReq = {
      url: '/api/index?route=health',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;
    const fakeRes = {
      setHeader: () => {},
      end: (chunk?: string) => {
        payload = String(chunk || '');
      },
      set statusCode(code: number) {
        status = code;
      },
      get statusCode() {
        return status;
      },
    } as unknown as ServerResponse;

    await apiHandler(fakeReq, fakeRes);
    const parsed = JSON.parse(payload);
    expect(status).toBe(200);
    expect(parsed.ok).toBe(true);
    expect(typeof parsed.dbConnected).toBe('boolean');
  });
});
