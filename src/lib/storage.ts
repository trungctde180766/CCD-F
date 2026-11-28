import { QUESTION_BANK, QUESTIONS_BY_ID } from '../data/questionBank';
import type {
  ActiveSession,
  AppProgressState,
  AttemptRecord,
  BackupPayload,
  BackupPreview,
  CustomExamPack,
  SessionHistoryItem,
  StudyMode,
} from '../types';
import { gradeQuestion } from './scoring';
import { computeNextSRSState } from './srs';

export const STORAGE_KEY = 'ccdv_f_study_progress_v1';
export const CURRENT_SCHEMA_VERSION = 1;
export const BACKUP_FORMAT_VERSION = 1;

export function getStorageKeyForUser(username?: string | null): string {
  const clean = (username || '').trim().toLowerCase();
  return clean ? `${STORAGE_KEY}_user_${clean}` : STORAGE_KEY;
}

export interface StorageStatus {
  available: boolean;
  error: string | null;
}

export function createInitialProgressState(): AppProgressState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    courseId: QUESTION_BANK.id,
    courseRevision: QUESTION_BANK.revision,
    viewedQuestions: {},
    bookmarks: {},
    notes: {},
    attempts: [],
    srs: {},
    activeSession: null,
    studyProgress: null,
    lastActiveTab: 'overview',
    sessionHistory: [],
    customExamPacks: [],
    lastStudiedQuestionId: null,
    updatedAt: new Date().toISOString(),
  };
}

export function checkLocalStorageHealth(): StorageStatus {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        available: false,
        error: 'Trình duyệt hiện tại không hỗ trợ localStorage. Tiến độ chỉ được giữ tạm trong phiên làm việc.',
      };
    }
    const testKey = '__ccdv_f_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return { available: true, error: null };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'QuotaExceededError'
        ? 'Bộ nhớ trình duyệt (localStorage) đã đầy. Hãy xuất bản sao lưu JSON và dọn bớt dữ liệu.'
        : 'Không thể truy cập localStorage (có thể do chế độ ẩn danh hoặc chặn cookie). Tiến độ sẽ chỉ lưu tạm trên RAM.';
    return { available: false, error: msg };
  }
}

function sanitizeCustomExamPacks(rawPacks: unknown): CustomExamPack[] {
  if (!Array.isArray(rawPacks)) return [];
  const validPacks: CustomExamPack[] = [];
  const seenIds = new Set<string>();
  for (const item of rawPacks) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Partial<CustomExamPack>;
    if (typeof p.id !== 'string' || !p.id.trim() || seenIds.has(p.id)) continue;
    if (!Array.isArray(p.questionIds)) continue;
    const uniqueValidQIds = Array.from(
      new Set(
        p.questionIds.filter(
          (qId): qId is string => typeof qId === 'string' && Boolean(QUESTIONS_BY_ID[qId])
        )
      )
    );
    if (uniqueValidQIds.length === 0) continue;
    seenIds.add(p.id);
    const nowIso = new Date().toISOString();
    validPacks.push({
      id: p.id.trim(),
      name:
        typeof p.name === 'string' && p.name.trim()
          ? p.name.trim().slice(0, 120)
          : `Gói đề tự chọn (${uniqueValidQIds.length} câu)`,
      questionIds: uniqueValidQIds,
      durationMinutes:
        typeof p.durationMinutes === 'number' && Number.isFinite(p.durationMinutes)
          ? Math.max(1, Math.min(240, Math.round(p.durationMinutes)))
          : Math.max(5, Math.min(180, Math.ceil(uniqueValidQIds.length * 1.5))),
      targetScorePercent:
        typeof p.targetScorePercent === 'number' && Number.isFinite(p.targetScorePercent)
          ? Math.max(10, Math.min(100, Math.round(p.targetScorePercent)))
          : 80,
      shuffleQuestions: typeof p.shuffleQuestions === 'boolean' ? p.shuffleQuestions : true,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : nowIso,
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : nowIso,
    });
  }
  return validPacks;
}

export function sanitizeProgressState(raw: unknown): AppProgressState {
  const initial = createInitialProgressState();
  if (!raw || typeof raw !== 'object') return initial;
  const obj = raw as Partial<AppProgressState>;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    courseId: typeof obj.courseId === 'string' ? obj.courseId : initial.courseId,
    courseRevision: typeof obj.courseRevision === 'number' ? obj.courseRevision : initial.courseRevision,
    viewedQuestions:
      obj.viewedQuestions && typeof obj.viewedQuestions === 'object' ? { ...obj.viewedQuestions } : {},
    bookmarks: obj.bookmarks && typeof obj.bookmarks === 'object' ? { ...obj.bookmarks } : {},
    notes: obj.notes && typeof obj.notes === 'object' ? { ...obj.notes } : {},
    attempts: Array.isArray(obj.attempts) ? obj.attempts : [],
    srs: obj.srs && typeof obj.srs === 'object' ? { ...obj.srs } : {},
    activeSession: obj.activeSession && typeof obj.activeSession === 'object' ? obj.activeSession : null,
    studyProgress:
      obj.studyProgress && typeof obj.studyProgress === 'object' ? obj.studyProgress : null,
    lastActiveTab:
      typeof obj.lastActiveTab === 'string' &&
      ['overview', 'study', 'practice', 'exam', 'review', 'admin'].includes(obj.lastActiveTab)
        ? obj.lastActiveTab
        : 'overview',
    sessionHistory: Array.isArray(obj.sessionHistory) ? obj.sessionHistory : [],
    customExamPacks: sanitizeCustomExamPacks(obj.customExamPacks),
    lastStudiedQuestionId:
      typeof obj.lastStudiedQuestionId === 'string' ? obj.lastStudiedQuestionId : null,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
  };
}

export function loadProgressState(username?: string | null): {
  state: AppProgressState;
  storageStatus: StorageStatus;
} {
  const health = checkLocalStorageHealth();
  if (!health.available) {
    return { state: createInitialProgressState(), storageStatus: health };
  }
  const key = getStorageKeyForUser(username);
  try {
    const serialized = window.localStorage.getItem(key);
    if (!serialized) {
      return { state: createInitialProgressState(), storageStatus: health };
    }
    const parsed = JSON.parse(serialized);
    return { state: sanitizeProgressState(parsed), storageStatus: health };
  } catch {
    return {
      state: createInitialProgressState(),
      storageStatus: {
        available: true,
        error: 'Dữ liệu lưu cục bộ bị hỏng định dạng; hệ thống đã khởi tạo trạng thái an toàn mới.',
      },
    };
  }
}

export function saveProgressState(
  state: AppProgressState,
  username?: string | null
): StorageStatus {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        available: false,
        error: 'Không có localStorage để lưu tiến độ.',
      };
    }
    const key = getStorageKeyForUser(username);
    const nextState: AppProgressState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(nextState));
    return { available: true, error: null };
  } catch (err) {
    const isQuota =
      err instanceof Error &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return {
      available: false,
      error: isQuota
        ? 'Bộ nhớ trình duyệt (localStorage) đã hết dung lượng. Vui lòng vào mục Thư viện & Sao lưu để tải file JSON về máy.'
        : 'Không thể ghi tiến độ vào localStorage.',
    };
  }
}

/**
 * Records viewing a question without creating an attempt or marking it as learned.
 */
export function markQuestionViewed(
  state: AppProgressState,
  questionId: string,
  now: Date = new Date()
): AppProgressState {
  if (!QUESTIONS_BY_ID[questionId]) return state;
  const alreadyViewed = state.viewedQuestions[questionId];
  return {
    ...state,
    lastStudiedQuestionId: questionId,
    viewedQuestions: alreadyViewed
      ? state.viewedQuestions
      : {
          ...state.viewedQuestions,
          [questionId]: now.toISOString(),
        },
  };
}

/**
 * Toggles a bookmark without creating any attempt.
 */
export function toggleQuestionBookmark(
  state: AppProgressState,
  questionId: string
): AppProgressState {
  const nextBookmarks = { ...state.bookmarks };
  if (nextBookmarks[questionId]) {
    delete nextBookmarks[questionId];
  } else {
    nextBookmarks[questionId] = true;
  }
  return {
    ...state,
    bookmarks: nextBookmarks,
  };
}

/**
 * Updates personal note for a question ID without creating any attempt.
 */
export function updateQuestionNote(
  state: AppProgressState,
  questionId: string,
  noteText: string
): AppProgressState {
  const nextNotes = { ...state.notes };
  const trimmed = noteText.trim();
  if (!trimmed) {
    delete nextNotes[questionId];
  } else {
    nextNotes[questionId] = noteText;
  }
  return {
    ...state,
    notes: nextNotes,
  };
}

/**
 * Records a single checked question attempt (in Study or Practice mode).
 * Idempotent if the activeSession has already checked this question in the current turn.
 */
export function recordSingleQuestionAttempt(
  state: AppProgressState,
  params: {
    questionId: string;
    selectedOptionIds: string[];
    sessionId: string;
    mode: StudyMode;
    revealedBeforeCheck: boolean;
    now?: Date;
  }
): { nextState: AppProgressState; attempt: AttemptRecord } {
  const now = params.now ?? new Date();
  const question = QUESTIONS_BY_ID[params.questionId];
  if (!question) {
    throw new Error(`Không tìm thấy câu hỏi ${params.questionId}`);
  }

  // Idempotency check if inside an active session that already checked this question
  if (
    state.activeSession &&
    state.activeSession.id === params.sessionId &&
    state.activeSession.checkedQuestions[params.questionId]
  ) {
    const existingCheck = state.activeSession.checkedQuestions[params.questionId];
    const existingAttempt = state.attempts.find((a) => a.id === existingCheck.attemptId);
    if (existingAttempt) {
      return { nextState: state, attempt: existingAttempt };
    }
  }

  const grade = gradeQuestion(question, params.selectedOptionIds);
  // If user revealed the answer beforehand, it is NOT counted as an unassisted correct answer
  const attemptId = `att_${params.sessionId}_${params.questionId}_${now.getTime()}`;

  const attempt: AttemptRecord = {
    id: attemptId,
    questionId: params.questionId,
    selectedOptionIds: grade.selectedOptionIds,
    correctOptionIds: [...question.interaction.correctOptionIds],
    isCorrect: grade.isCorrect,
    answeredAt: now.toISOString(),
    sessionId: params.sessionId,
    mode: params.mode,
    revealedBeforeCheck: params.revealedBeforeCheck,
  };

  const nextSrsItem = computeNextSRSState(params.questionId, state.srs[params.questionId], {
    isCorrect: grade.isCorrect,
    revealedBeforeCheck: params.revealedBeforeCheck,
    now,
  });

  let nextActiveSession = state.activeSession;
  if (nextActiveSession && nextActiveSession.id === params.sessionId) {
    nextActiveSession = {
      ...nextActiveSession,
      selections: {
        ...nextActiveSession.selections,
        [params.questionId]: grade.selectedOptionIds,
      },
      checkedQuestions: {
        ...nextActiveSession.checkedQuestions,
        [params.questionId]: {
          isCorrect: grade.isCorrect,
          revealedBeforeCheck: params.revealedBeforeCheck,
          answeredAt: now.toISOString(),
          attemptId,
        },
      },
    };
  }

  const nextState: AppProgressState = {
    ...state,
    viewedQuestions: {
      ...state.viewedQuestions,
      [params.questionId]: state.viewedQuestions[params.questionId] || now.toISOString(),
    },
    attempts: [...state.attempts, attempt],
    srs: {
      ...state.srs,
      [params.questionId]: nextSrsItem,
    },
    activeSession: nextActiveSession,
    lastStudiedQuestionId: params.questionId,
  };

  return { nextState, attempt };
}

/**
 * Idempotently submits an active session (Mock Exam or Practice completion).
 * - If session is already submitted (status === 'completed' or exists in sessionHistory), returns state unchanged.
 * - For Exam mode: grades every question in questionOrder (including unanswered questions as wrong),
 *   appends attempts once, updates SRS state, and records SessionHistoryItem.
 * - For Practice mode: summarizes already-checked questions and grades any remaining questions if needed.
 */
export function submitActiveSessionIdempotent(
  state: AppProgressState,
  options?: { autoSubmittedByTimeout?: boolean; now?: Date }
): { nextState: AppProgressState; historyItem: SessionHistoryItem | null } {
  const session = state.activeSession;
  if (!session) {
    return { nextState: state, historyItem: null };
  }

  // Idempotency guard: if already submitted or already in sessionHistory, do not duplicate attempts!
  const existingHistory = state.sessionHistory.find((h) => h.id === session.id);
  if (session.status === 'completed' || session.submittedAt || existingHistory) {
    return {
      nextState: {
        ...state,
        activeSession: {
          ...session,
          status: 'completed',
          submittedAt: session.submittedAt || existingHistory?.submittedAt || new Date().toISOString(),
        },
      },
      historyItem: existingHistory ?? null,
    };
  }

  const now = options?.now ?? new Date();
  const submittedAt = now.toISOString();

  const newAttempts: AttemptRecord[] = [];
  const nextSrs = { ...state.srs };
  const nextViewed = { ...state.viewedQuestions };
  const nextChecked = { ...session.checkedQuestions };

  let answeredCount = 0;
  let correctCount = 0;

  for (const qId of session.questionOrder) {
    const question = QUESTIONS_BY_ID[qId];
    if (!question) continue;

    const selected = session.selections[qId] || [];
    if (selected.length > 0) {
      answeredCount++;
    }

    if (!nextViewed[qId]) {
      nextViewed[qId] = submittedAt;
    }

    // Check if this question was already graded during this session (e.g. in Practice mode)
    const alreadyChecked = session.checkedQuestions[qId];
    if (alreadyChecked) {
      if (alreadyChecked.isCorrect) {
        correctCount++;
      }
      continue;
    }

    // Grade now (in Exam mode, or unchecked questions in Practice mode; unanswered is graded as wrong)
    const grade = gradeQuestion(question, selected);
    if (grade.isCorrect) {
      correctCount++;
    }
    const revealed = Boolean(session.revealedQuestions[qId]);
    const attemptId = `att_${session.id}_${qId}_${now.getTime()}`;

    const attempt: AttemptRecord = {
      id: attemptId,
      questionId: qId,
      selectedOptionIds: grade.selectedOptionIds,
      correctOptionIds: [...question.interaction.correctOptionIds],
      isCorrect: grade.isCorrect,
      answeredAt: submittedAt,
      sessionId: session.id,
      mode: session.mode,
      revealedBeforeCheck: revealed,
    };

    newAttempts.push(attempt);
    nextChecked[qId] = {
      isCorrect: grade.isCorrect,
      revealedBeforeCheck: revealed,
      answeredAt: submittedAt,
      attemptId,
    };

    nextSrs[qId] = computeNextSRSState(qId, nextSrs[qId], {
      isCorrect: grade.isCorrect,
      revealedBeforeCheck: revealed,
      now,
    });
  }

  const totalQuestions = session.questionOrder.length;
  const scorePercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) / 10 : 0;
  const passed =
    session.targetScorePercent !== null ? scorePercent >= session.targetScorePercent : null;

  const durationSeconds = Math.max(
    1,
    Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000)
  );

  const completedSession: ActiveSession = {
    ...session,
    checkedQuestions: nextChecked,
    submittedAt,
    status: 'completed',
    autoSubmittedByTimeout: Boolean(options?.autoSubmittedByTimeout),
  };

  const historyItem: SessionHistoryItem = {
    id: session.id,
    mode: session.mode,
    title: session.title,
    filterLabel: session.filterLabel,
    totalQuestions,
    answeredCount,
    correctCount,
    scorePercent,
    targetScorePercent: session.targetScorePercent,
    passed,
    startedAt: session.startedAt,
    submittedAt,
    durationSeconds,
    autoSubmittedByTimeout: Boolean(options?.autoSubmittedByTimeout),
    questionOrder: [...session.questionOrder],
    selections: { ...session.selections },
    flaggedQuestions: { ...session.flaggedQuestions },
  };

  const nextState: AppProgressState = {
    ...state,
    viewedQuestions: nextViewed,
    attempts: [...state.attempts, ...newAttempts],
    srs: nextSrs,
    activeSession: completedSession,
    sessionHistory: [historyItem, ...state.sessionHistory],
  };

  return { nextState, historyItem };
}

/**
 * Creates a backup JSON payload with version, export timestamp, and question bank metadata.
 */
export function exportBackupPayload(state: AppProgressState, now: Date = new Date()): BackupPayload {
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    courseId: QUESTION_BANK.id,
    courseRevision: QUESTION_BANK.revision,
    questionCount: QUESTION_BANK.questions.length,
    data: {
      ...state,
      updatedAt: now.toISOString(),
    },
  };
}

/**
 * Validates a backup JSON string before importing and produces a preview of counts.
 * Never mutates current state.
 */
export function validateAndPreviewBackupJson(jsonText: string): BackupPreview {
  const errors: string[] = [];
  if (!jsonText || !jsonText.trim()) {
    return { isValid: false, errors: ['Nội dung file JSON trống.'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      isValid: false,
      errors: ['File không đúng cú pháp JSON. Dữ liệu hiện tại được giữ nguyên an toàn.'],
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      isValid: false,
      errors: ['Cấu trúc gốc của file sao lưu phải là một JSON Object.'],
    };
  }

  const candidate = parsed as Partial<BackupPayload>;
  if (typeof candidate.backupFormatVersion !== 'number') {
    errors.push('Thiếu hoặc sai kiểu trường backupFormatVersion.');
  }
  if (candidate.courseId !== QUESTION_BANK.id) {
    errors.push(
      `Mã ngân hàng câu hỏi không khớp: mong đợi "${QUESTION_BANK.id}", nhận được "${String(candidate.courseId)}".`
    );
  }
  if (!candidate.data || typeof candidate.data !== 'object' || Array.isArray(candidate.data)) {
    errors.push('Thiếu trường data chứa dữ liệu tiến độ.');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const data = candidate.data as Partial<AppProgressState>;
  if (data.attempts !== undefined && !Array.isArray(data.attempts)) {
    errors.push('Trường data.attempts phải là một mảng.');
  }
  if (data.sessionHistory !== undefined && !Array.isArray(data.sessionHistory)) {
    errors.push('Trường data.sessionHistory phải là một mảng.');
  }
  if (data.bookmarks !== undefined && (typeof data.bookmarks !== 'object' || Array.isArray(data.bookmarks))) {
    errors.push('Trường data.bookmarks phải là một object.');
  }
  if (data.notes !== undefined && (typeof data.notes !== 'object' || Array.isArray(data.notes))) {
    errors.push('Trường data.notes phải là một object.');
  }

  if (Array.isArray(data.attempts)) {
    for (const att of data.attempts) {
      if (!att || typeof att !== 'object' || typeof att.questionId !== 'string' || !QUESTIONS_BY_ID[att.questionId]) {
        errors.push(`Bản ghi lịch sử trả lời có questionId không hợp lệ: "${String(att?.questionId)}".`);
        break;
      }
      if (!Array.isArray(att.selectedOptionIds) || typeof att.isCorrect !== 'boolean') {
        errors.push(`Bản ghi lịch sử trả lời của câu ${att.questionId} thiếu dữ liệu chấm điểm.`);
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const cleanData = sanitizeProgressState(data);
  const answeredUniqueIds = new Set(cleanData.attempts.map((a) => a.questionId));

  return {
    isValid: true,
    errors: [],
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : undefined,
    courseId: candidate.courseId,
    courseRevision: candidate.courseRevision,
    counts: {
      viewedCount: Object.keys(cleanData.viewedQuestions).length,
      answeredQuestionsCount: answeredUniqueIds.size,
      totalAttemptsCount: cleanData.attempts.length,
      bookmarksCount: Object.keys(cleanData.bookmarks).filter((k) => cleanData.bookmarks[k]).length,
      notesCount: Object.keys(cleanData.notes).filter((k) => cleanData.notes[k]?.trim()).length,
      srsCount: Object.keys(cleanData.srs).length,
      sessionsCount: cleanData.sessionHistory.length,
    },
    payload: {
      backupFormatVersion: candidate.backupFormatVersion!,
      exportedAt: candidate.exportedAt || new Date().toISOString(),
      courseId: candidate.courseId!,
      courseRevision: candidate.courseRevision ?? QUESTION_BANK.revision,
      questionCount: candidate.questionCount ?? QUESTION_BANK.questions.length,
      data: cleanData,
    },
  };
}

/**
 * Applies a validated backup payload in either 'replace' or 'merge' mode.
 */
export function applyBackupImport(
  currentState: AppProgressState,
  payload: BackupPayload,
  mode: 'replace' | 'merge'
): AppProgressState {
  const incoming = sanitizeProgressState(payload.data);
  if (mode === 'replace') {
    return {
      ...incoming,
      updatedAt: new Date().toISOString(),
    };
  }

  // Merge mode: combine viewedQuestions, bookmarks, notes, deduplicate attempts & sessions by id, pick latest SRS by lastReviewedAt
  const mergedViewed = { ...incoming.viewedQuestions, ...currentState.viewedQuestions };
  for (const [qId, ts] of Object.entries(incoming.viewedQuestions)) {
    if (!mergedViewed[qId] || ts < mergedViewed[qId]) {
      mergedViewed[qId] = ts;
    }
  }

  const mergedBookmarks = { ...currentState.bookmarks };
  for (const [qId, val] of Object.entries(incoming.bookmarks)) {
    if (val) mergedBookmarks[qId] = true;
  }

  const mergedNotes = { ...incoming.notes, ...currentState.notes };
  for (const [qId, note] of Object.entries(incoming.notes)) {
    const currentNote = currentState.notes[qId];
    if (currentNote && currentNote !== note) {
      mergedNotes[qId] = `${currentNote}\n---\n${note}`;
    } else if (!currentNote) {
      mergedNotes[qId] = note;
    }
  }

  const attemptMap = new Map<string, AttemptRecord>();
  for (const a of [...currentState.attempts, ...incoming.attempts]) {
    const key = a.id || `${a.sessionId}_${a.questionId}_${a.answeredAt}`;
    attemptMap.set(key, a);
  }
  const mergedAttempts = Array.from(attemptMap.values()).sort((a, b) =>
    a.answeredAt.localeCompare(b.answeredAt)
  );

  const mergedSrs = { ...currentState.srs };
  for (const [qId, incSrs] of Object.entries(incoming.srs)) {
    const curSrs = mergedSrs[qId];
    if (!curSrs || incSrs.lastReviewedAt > curSrs.lastReviewedAt) {
      mergedSrs[qId] = incSrs;
    }
  }

  const sessionMap = new Map<string, SessionHistoryItem>();
  for (const s of [...currentState.sessionHistory, ...incoming.sessionHistory]) {
    sessionMap.set(s.id, s);
  }
  const mergedSessions = Array.from(sessionMap.values()).sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt)
  );

  const packMap = new Map<string, CustomExamPack>();
  for (const p of [...(currentState.customExamPacks || []), ...(incoming.customExamPacks || [])]) {
    const existing = packMap.get(p.id);
    if (!existing || p.updatedAt > existing.updatedAt) {
      packMap.set(p.id, p);
    }
  }
  const mergedPacks = Array.from(packMap.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );

  return {
    ...currentState,
    viewedQuestions: mergedViewed,
    bookmarks: mergedBookmarks,
    notes: mergedNotes,
    attempts: mergedAttempts,
    srs: mergedSrs,
    sessionHistory: mergedSessions,
    customExamPacks: mergedPacks,
    activeSession: currentState.activeSession ?? incoming.activeSession,
    studyProgress:
      currentState.studyProgress && incoming.studyProgress
        ? currentState.studyProgress.updatedAt >= incoming.studyProgress.updatedAt
          ? currentState.studyProgress
          : incoming.studyProgress
        : currentState.studyProgress ?? incoming.studyProgress,
    lastActiveTab: currentState.lastActiveTab ?? incoming.lastActiveTab,
    lastStudiedQuestionId: currentState.lastStudiedQuestionId ?? incoming.lastStudiedQuestionId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates or updates a user's custom exam pack (a hand-picked bundle of questions).
 */
export function upsertCustomExamPack(
  state: AppProgressState,
  input: {
    id?: string;
    name: string;
    questionIds: string[];
    durationMinutes: number;
    targetScorePercent: number;
    shuffleQuestions: boolean;
  },
  now: Date = new Date()
): { nextState: AppProgressState; pack: CustomExamPack | null } {
  const uniqueValidIds = Array.from(
    new Set(input.questionIds.filter((qId) => Boolean(QUESTIONS_BY_ID[qId])))
  );
  if (uniqueValidIds.length === 0) {
    return { nextState: state, pack: null };
  }

  const nowIso = now.toISOString();
  const existingPacks = state.customExamPacks || [];
  const existing = input.id ? existingPacks.find((p) => p.id === input.id) : undefined;

  const pack: CustomExamPack = {
    id: existing ? existing.id : input.id || `pack_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    name:
      input.name.trim().slice(0, 120) ||
      `Gói đề tự chọn #${existingPacks.length + 1} (${uniqueValidIds.length} câu)`,
    questionIds: uniqueValidIds,
    durationMinutes: Math.max(1, Math.min(240, Math.round(input.durationMinutes || 30))),
    targetScorePercent: Math.max(10, Math.min(100, Math.round(input.targetScorePercent || 80))),
    shuffleQuestions: Boolean(input.shuffleQuestions),
    createdAt: existing ? existing.createdAt : nowIso,
    updatedAt: nowIso,
  };

  const nextPacks = existing
    ? existingPacks.map((p) => (p.id === pack.id ? pack : p))
    : [pack, ...existingPacks];

  return {
    nextState: {
      ...state,
      customExamPacks: nextPacks,
      updatedAt: nowIso,
    },
    pack,
  };
}

/**
 * Deletes a saved custom exam pack by ID.
 */
export function deleteCustomExamPack(
  state: AppProgressState,
  packId: string
): AppProgressState {
  const existingPacks = state.customExamPacks || [];
  const nextPacks = existingPacks.filter((p) => p.id !== packId);
  if (nextPacks.length === existingPacks.length) return state;
  return {
    ...state,
    customExamPacks: nextPacks,
    updatedAt: new Date().toISOString(),
  };
}
