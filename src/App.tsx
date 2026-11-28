import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COURSES,
  detectCourseIdFromQuestionId,
  getCourseBundle,
} from './data/questionBank';
import {
  apiFetchMe,
  apiSendHeartbeat,
  apiSyncProgress,
  loadStoredAuthSession,
  reconcileUserProgress,
  saveStoredAuthSession,
} from './lib/auth';
import {
  applyBackupImport,
  createInitialProgressState,
  deleteCustomExamPack,
  loadProgressState,
  loadSelectedCourseId,
  markQuestionViewed,
  recordSingleQuestionAttempt,
  saveProgressState,
  saveSelectedCourseId,
  StorageStatus,
  submitActiveSessionIdempotent,
  toggleQuestionBookmark,
  updateQuestionNote,
  upsertCustomExamPack,
} from './lib/storage';
import { computeAggregateStats } from './lib/stats';
import { createSessionFromPool } from './lib/session';
import type {
  ActiveSession,
  AppProgressState,
  AuthUser,
  BackupPayload,
  CourseId,
  CustomExamPack,
  NavigationTab,
  QuestionFilterType,
  StudySessionProgress,
} from './types';
import type { CustomPackDraftInput } from './components/CustomExamPackBuilder';
import { AuthGatePage } from './components/AuthGatePage';
import { AuthModal } from './components/AuthModal';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { getDefaultStudyProgress, StudyPage } from './pages/StudyPage';
import { PracticePage } from './pages/PracticePage';
import { ExamPage } from './pages/ExamPage';
import { ReviewPage } from './pages/ReviewPage';
import { LibraryBackupPage } from './pages/LibraryBackupPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

const THEME_STORAGE_KEY = 'ccdv_f_theme_dark';

export const App: React.FC = () => {
  const [authSession, setAuthSession] = useState<{
    token: string;
    user: AuthUser;
  } | null>(() => loadStoredAuthSession());

  const [activeCourseId, setActiveCourseId] = useState<CourseId>(() => loadSelectedCourseId());
  const activeCourse = useMemo(() => getCourseBundle(activeCourseId), [activeCourseId]);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [cloudSynced, setCloudSynced] = useState<boolean>(false);

  const currentUsername = authSession?.user?.username || null;

  const [{ state, storageStatus }, setAppStore] = useState<{
    state: AppProgressState;
    storageStatus: StorageStatus;
  }>(() => loadProgressState(loadStoredAuthSession()?.user?.username, loadSelectedCourseId()));

  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    const storedAuth = loadStoredAuthSession();
    const initialCourseId = loadSelectedCourseId();
    const loaded = loadProgressState(storedAuth?.user?.username, initialCourseId).state;
    if (loaded.activeSession && loaded.activeSession.status === 'in_progress') {
      if (loaded.activeSession.mode === 'exam') return 'exam';
      if (loaded.activeSession.mode === 'practice') return 'practice';
    }
    if (loaded.lastActiveTab) {
      if (loaded.lastActiveTab === 'admin' && storedAuth?.user?.role !== 'admin') {
        return 'overview';
      }
      return loaded.lastActiveTab;
    }
    return 'overview';
  });

  const [externalStudyOverride, setExternalStudyOverride] = useState<{
    filter: QuestionFilterType;
    questionId?: string;
    tag?: string;
    nonce: number;
  } | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? '1' : '0');
    } catch {
      // ignore if localStorage blocked
    }
  }, [darkMode]);

  // Verify auth session with server and reconcile cloud progress for BOTH courses on mount
  useEffect(() => {
    if (!authSession?.token) return;
    let cancelled = false;

    apiFetchMe(authSession.token)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok || !res.user) {
          return;
        }
        setCloudSynced(Boolean(res.dbConnected));
        const byCourse: Record<string, unknown> = { ...(res.progressByCourse || {}) };
        if (res.progress && !byCourse['ccdv-f']) {
          byCourse['ccdv-f'] = res.progress;
        }

        // Reconcile every available course cleanly into its own course-scoped localStorage key
        for (const c of COURSES) {
          if (byCourse[c.id]) {
            const localCourseState = loadProgressState(res.user.username, c.id).state;
            const mergedCourse = reconcileUserProgress(localCourseState, byCourse[c.id], c.id);
            saveProgressState(mergedCourse, res.user.username, c.id);
          }
        }

        const activeServerProg = byCourse[activeCourseId];
        if (activeServerProg) {
          setAppStore((current) => {
            const merged = reconcileUserProgress(current.state, activeServerProg, activeCourseId);
            const saveRes = saveProgressState(merged, res.user!.username, activeCourseId);
            return { state: merged, storageStatus: saveRes };
          });
        }
      })
      .catch(() => {
        // Keep local user progress gracefully if offline
      });

    return () => {
      cancelled = true;
    };
  }, [authSession?.token, activeCourseId]);

  const syncTimeoutRef = useRef<number | null>(null);

  // Build human-readable activity description for live admin telemetry
  const currentActivityDescription = useMemo(() => {
    const prefix = `[${activeCourse.shortCode}] `;
    const sess = state.activeSession;
    if (activeTab === 'exam' && sess && sess.mode === 'exam' && sess.status === 'in_progress') {
      const idx = sess.questionOrder.indexOf(sess.currentQuestionId) + 1;
      const ans = Object.keys(sess.selections || {}).length;
      return `${prefix}Đang Thi thử: Câu ${idx}/${sess.questionOrder.length} (Đã chọn ${ans} câu)`;
    }
    if (
      activeTab === 'practice' &&
      sess &&
      sess.mode === 'practice' &&
      sess.status === 'in_progress'
    ) {
      const idx = sess.questionOrder.indexOf(sess.currentQuestionId) + 1;
      return `${prefix}Đang Luyện tập: Câu ${idx}/${sess.questionOrder.length}`;
    }
    if (activeTab === 'study') {
      const curQ =
        state.studyProgress?.currentQuestionId ||
        state.lastStudiedQuestionId ||
        activeCourse.firstQuestionId;
      return `${prefix}Đang Học từng câu (${curQ})`;
    }
    if (activeTab === 'review') return `${prefix}Đang xem Lịch ôn & Câu sai`;
    if (activeTab === 'library') return `${prefix}Đang xem Thư viện & Sao lưu`;
    if (activeTab === 'admin') return 'Đang mở Admin Dashboard';
    return `${prefix}Đang xem Tổng quan`;
  }, [
    activeCourse.shortCode,
    activeCourse.firstQuestionId,
    activeTab,
    state.activeSession,
    state.studyProgress?.currentQuestionId,
    state.lastStudiedQuestionId,
  ]);

  // Periodic & reactive heartbeat for live online status, device, IP & exam tracking
  useEffect(() => {
    if (!authSession?.token) return;
    const sendPulse = () => {
      apiSendHeartbeat(authSession.token, {
        currentTab: activeTab,
        activityStatus: currentActivityDescription,
        currentQuestionId:
          state.activeSession?.currentQuestionId ||
          state.studyProgress?.currentQuestionId ||
          state.lastStudiedQuestionId ||
          null,
      }).catch(() => {});
    };

    sendPulse();
    const intervalId = window.setInterval(sendPulse, 15000);
    return () => window.clearInterval(intervalId);
  }, [
    authSession?.token,
    activeTab,
    currentActivityDescription,
    state.activeSession?.currentQuestionId,
    state.studyProgress?.currentQuestionId,
    state.lastStudiedQuestionId,
  ]);

  const scheduleCloudSync = useCallback(
    (nextState: AppProgressState, token: string | null) => {
      if (!token) return;
      if (syncTimeoutRef.current !== null) {
        window.clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = window.setTimeout(() => {
        apiSyncProgress(token, nextState)
          .then((res) => {
            if (res.ok) setCloudSynced(true);
          })
          .catch(() => {
            setCloudSynced(false);
          });
      }, 300);
    },
    []
  );

  const updateStateAndPersist = useCallback(
    (updater: (prev: AppProgressState) => AppProgressState) => {
      setAppStore((current) => {
        const nextState = updater(current.state);
        if (nextState === current.state) return current;
        const saveRes = saveProgressState(nextState, currentUsername, activeCourseId);
        scheduleCloudSync(nextState, authSession?.token || null);
        return {
          state: nextState,
          storageStatus: saveRes,
        };
      });
    },
    [currentUsername, activeCourseId, authSession?.token, scheduleCloudSync]
  );

  const handleSelectCourse = useCallback(
    (nextCourseId: CourseId) => {
      if (nextCourseId === activeCourseId) return;
      saveSelectedCourseId(nextCourseId);
      setActiveCourseId(nextCourseId);
      setExternalStudyOverride(null);
      const loaded = loadProgressState(currentUsername, nextCourseId);
      setAppStore(loaded);
    },
    [activeCourseId, currentUsername]
  );

  const handleSelectTab = useCallback(
    (tab: NavigationTab) => {
      setActiveTab(tab);
      updateStateAndPersist((prev) => ({
        ...prev,
        lastActiveTab: tab,
      }));
    },
    [updateStateAndPersist]
  );

  const handleAuthSuccess = useCallback(
    (params: {
      token: string;
      user: AuthUser;
      serverProgress: unknown;
      serverProgressByCourse?: Record<string, unknown>;
      dbConnected: boolean;
    }) => {
      const nextAuth = { token: params.token, user: params.user };
      saveStoredAuthSession(nextAuth);
      setAuthSession(nextAuth);
      setCloudSynced(params.dbConnected);

      const byCourse: Record<string, unknown> = { ...(params.serverProgressByCourse || {}) };
      if (params.serverProgress && !byCourse['ccdv-f']) {
        byCourse['ccdv-f'] = params.serverProgress;
      }

      // Reconcile each course independently so Developer & Associate never overwrite each other
      let activeMerged = loadProgressState(params.user.username, activeCourseId).state;
      let activeSaveRes: StorageStatus = { available: true, error: null };

      for (const c of COURSES) {
        const userLocal = loadProgressState(params.user.username, c.id).state;
        const merged = reconcileUserProgress(userLocal, byCourse[c.id], c.id);
        const saveRes = saveProgressState(merged, params.user.username, c.id);
        if (c.id === activeCourseId) {
          activeMerged = merged;
          activeSaveRes = saveRes;
        }
        if (merged.attempts.length > 0 || merged.sessionHistory.length > 0) {
          apiSyncProgress(params.token, merged).catch(() => {});
        }
      }

      setAppStore({ state: activeMerged, storageStatus: activeSaveRes });

      if (params.user.role === 'admin') {
        setActiveTab('admin');
      } else if (activeMerged.activeSession?.status === 'in_progress') {
        setActiveTab(activeMerged.activeSession.mode === 'exam' ? 'exam' : 'practice');
      } else if (activeMerged.lastActiveTab && activeMerged.lastActiveTab !== 'admin') {
        setActiveTab(activeMerged.lastActiveTab);
      } else {
        setActiveTab('overview');
      }
    },
    [activeCourseId]
  );

  const handleLogout = useCallback(() => {
    saveStoredAuthSession(null);
    setAuthSession(null);
    setCloudSynced(false);
    const guestLoaded = loadProgressState(null, activeCourseId);
    setAppStore(guestLoaded);
    setActiveTab('overview');
  }, [activeCourseId]);

  const stats = useMemo(
    () => computeAggregateStats(state, new Date(), activeCourse.questions),
    [state, activeCourse.questions]
  );

  const handleMarkViewed = useCallback(
    (questionId: string) => {
      updateStateAndPersist((prev) => markQuestionViewed(prev, questionId));
    },
    [updateStateAndPersist]
  );

  const handleToggleBookmark = useCallback(
    (questionId: string) => {
      updateStateAndPersist((prev) => toggleQuestionBookmark(prev, questionId));
    },
    [updateStateAndPersist]
  );

  const handleSaveNote = useCallback(
    (questionId: string, note: string) => {
      updateStateAndPersist((prev) => updateQuestionNote(prev, questionId, note));
    },
    [updateStateAndPersist]
  );

  const handleUpdateStudyProgress = useCallback(
    (updater: (prev: StudySessionProgress) => StudySessionProgress) => {
      updateStateAndPersist((prev) => {
        const base =
          prev.studyProgress ||
          getDefaultStudyProgress(prev.lastStudiedQuestionId, activeCourseId);
        const nextStudy = updater(base);
        return {
          ...prev,
          studyProgress: nextStudy,
          lastStudiedQuestionId: nextStudy.currentQuestionId,
        };
      });
    },
    [updateStateAndPersist, activeCourseId]
  );

  const handleResetStudyPassOnly = useCallback(() => {
    const firstId = activeCourse.firstQuestionId;
    updateStateAndPersist((prev) => ({
      ...prev,
      studyProgress: getDefaultStudyProgress(firstId, activeCourseId),
      lastStudiedQuestionId: firstId,
    }));
  }, [updateStateAndPersist, activeCourse.firstQuestionId, activeCourseId]);

  const handleRecordStudyAttempt = useCallback(
    (params: {
      questionId: string;
      selectedOptionIds: string[];
      revealedBeforeCheck: boolean;
    }) => {
      updateStateAndPersist((prev) => {
        const { nextState } = recordSingleQuestionAttempt(prev, {
          questionId: params.questionId,
          selectedOptionIds: params.selectedOptionIds,
          sessionId: 'study_individual',
          mode: 'study',
          revealedBeforeCheck: params.revealedBeforeCheck,
        });
        return nextState;
      });
    },
    [updateStateAndPersist]
  );

  const handleStartSession = useCallback(
    (session: ActiveSession) => {
      const targetTab: NavigationTab =
        session.mode === 'exam' ? 'exam' : session.mode === 'practice' ? 'practice' : 'study';
      updateStateAndPersist((prev) => ({
        ...prev,
        activeSession: session,
        lastActiveTab: targetTab,
      }));
      setActiveTab(targetTab);
    },
    [updateStateAndPersist]
  );

  const handleRestartExamFromBeginning = useCallback(() => {
    updateStateAndPersist((prev) => {
      if (!prev.activeSession || prev.activeSession.mode !== 'exam') return prev;
      const old = prev.activeSession;
      const now = new Date();
      const durationMinutes = old.durationMinutes ?? 45;
      const freshExam: ActiveSession = {
        ...old,
        id: `sess_exam_${now.getTime()}`,
        currentQuestionId: old.questionOrder[0],
        selections: {},
        checkedQuestions: {},
        revealedQuestions: {},
        flaggedQuestions: {},
        startedAt: now.toISOString(),
        deadline: now.getTime() + durationMinutes * 60 * 1000,
        submittedAt: null,
        status: 'in_progress',
        autoSubmittedByTimeout: false,
      };
      return {
        ...prev,
        activeSession: freshExam,
      };
    });
  }, [updateStateAndPersist]);

  const handleUpdateSessionSelection = useCallback(
    (questionId: string, selectedOptionIds: string[]) => {
      updateStateAndPersist((prev) => {
        if (!prev.activeSession || prev.activeSession.status !== 'in_progress') return prev;
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            selections: {
              ...prev.activeSession.selections,
              [questionId]: selectedOptionIds,
            },
          },
        };
      });
    },
    [updateStateAndPersist]
  );

  const handleCheckPracticeQuestion = useCallback(
    (questionId: string, selectedOptionIds: string[]) => {
      updateStateAndPersist((prev) => {
        if (!prev.activeSession || prev.activeSession.mode !== 'practice') return prev;
        const { nextState } = recordSingleQuestionAttempt(prev, {
          questionId,
          selectedOptionIds,
          sessionId: prev.activeSession.id,
          mode: 'practice',
          revealedBeforeCheck: false,
        });
        return nextState;
      });
    },
    [updateStateAndPersist]
  );

  const handleToggleExamFlag = useCallback(
    (questionId: string) => {
      updateStateAndPersist((prev) => {
        if (!prev.activeSession) return prev;
        const nextFlags = { ...prev.activeSession.flaggedQuestions };
        if (nextFlags[questionId]) {
          delete nextFlags[questionId];
        } else {
          nextFlags[questionId] = true;
        }
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            flaggedQuestions: nextFlags,
          },
        };
      });
    },
    [updateStateAndPersist]
  );

  const handleSetCurrentSessionQuestion = useCallback(
    (questionId: string) => {
      updateStateAndPersist((prev) => {
        if (!prev.activeSession) return prev;
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            currentQuestionId: questionId,
          },
        };
      });
    },
    [updateStateAndPersist]
  );

  const handleSubmitActiveSession = useCallback(
    (autoSubmittedByTimeout = false) => {
      updateStateAndPersist((prev) => {
        const { nextState } = submitActiveSessionIdempotent(prev, {
          autoSubmittedByTimeout,
        });
        return nextState;
      });
    },
    [updateStateAndPersist]
  );

  const handleExitSession = useCallback(() => {
    updateStateAndPersist((prev) => ({
      ...prev,
      activeSession: null,
    }));
  }, [updateStateAndPersist]);

  const handleOpenStudyWithFilter = useCallback(
    (filter: QuestionFilterType, questionId?: string, tag = 'all') => {
      if (questionId) {
        const targetCourseId = detectCourseIdFromQuestionId(questionId);
        if (targetCourseId !== activeCourseId) {
          saveSelectedCourseId(targetCourseId);
          setActiveCourseId(targetCourseId);
          const loaded = loadProgressState(currentUsername, targetCourseId);
          setAppStore(loaded);
        }
      }
      setExternalStudyOverride({ filter, questionId, tag, nonce: Date.now() });
      setActiveTab('study');
    },
    [activeCourseId, currentUsername]
  );

  const handleResumeActiveSession = useCallback(() => {
    if (!state.activeSession) return;
    if (state.activeSession.mode === 'exam') {
      handleSelectTab('exam');
    } else if (state.activeSession.mode === 'practice') {
      handleSelectTab('practice');
    } else {
      handleSelectTab('study');
    }
  }, [state.activeSession, handleSelectTab]);

  const handleStartQuickPracticeFromReview = useCallback(
    (filter: QuestionFilterType) => {
      const res = createSessionFromPool(stats, {
        mode: 'practice',
        filterType: filter,
        requestedCount: 30,
        shuffleQuestions: true,
        questions: activeCourse.questions,
        course: activeCourse,
      });
      if (res.session) {
        handleStartSession(res.session);
      }
    },
    [stats, activeCourse, handleStartSession]
  );

  const handleResetAllProgress = useCallback(() => {
    updateStateAndPersist(() => ({
      ...createInitialProgressState(activeCourseId),
      studyProgress: getDefaultStudyProgress(activeCourse.firstQuestionId, activeCourseId),
      lastActiveTab: activeTab,
    }));
  }, [updateStateAndPersist, activeCourseId, activeCourse.firstQuestionId, activeTab]);

  const handleImportBackup = useCallback(
    (payload: BackupPayload, mode: 'merge' | 'replace') => {
      updateStateAndPersist((prev) => applyBackupImport(prev, payload, mode));
    },
    [updateStateAndPersist]
  );

  const handleSaveCustomPack = useCallback(
    (draft: CustomPackDraftInput): CustomExamPack | null => {
      const now = new Date();
      const packId =
        draft.id || `pack_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`;
      const preview = upsertCustomExamPack(state, { ...draft, id: packId }, now);
      if (!preview.pack) return null;
      updateStateAndPersist((prev) => upsertCustomExamPack(prev, { ...draft, id: packId }, now).nextState);
      return preview.pack;
    },
    [state, updateStateAndPersist]
  );

  const handleDeleteCustomPack = useCallback(
    (packId: string) => {
      updateStateAndPersist((prev) => deleteCustomExamPack(prev, packId));
    },
    [updateStateAndPersist]
  );

  // MANDATORY LOGIN GATE: Users must authenticate before accessing any study/exam content
  if (!authSession || !authSession.user) {
    return (
      <AuthGatePage
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  return (
    <Layout
      activeCourse={activeCourse}
      courses={COURSES}
      onSelectCourse={handleSelectCourse}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((d) => !d)}
      dueCount={stats.dueForReviewCount}
      wrongLatestCount={stats.wrongLatestCount}
      activeSession={state.activeSession}
      onResumeActiveSession={handleResumeActiveSession}
      storageStatus={storageStatus}
      authUser={authSession.user}
      cloudSynced={cloudSynced}
      onOpenAuthModal={() => setIsAuthModalOpen(true)}
      onLogout={handleLogout}
    >
      {activeTab === 'overview' && (
        <OverviewPage
          course={activeCourse}
          courses={COURSES}
          onSelectCourse={handleSelectCourse}
          state={state}
          stats={stats}
          onNavigateTab={handleSelectTab}
          onOpenStudyWithFilter={handleOpenStudyWithFilter}
          onResumeActiveSession={handleResumeActiveSession}
          onDiscardActiveSession={handleExitSession}
          onResetAllProgress={handleResetAllProgress}
        />
      )}

      {activeTab === 'study' && (
        <StudyPage
          key={activeCourse.id}
          course={activeCourse}
          state={state}
          stats={stats}
          externalFilterOverride={externalStudyOverride}
          onUpdateStudyProgress={handleUpdateStudyProgress}
          onResetStudyPassOnly={handleResetStudyPassOnly}
          onResetAllProgress={handleResetAllProgress}
          onMarkViewed={handleMarkViewed}
          onRecordAttempt={handleRecordStudyAttempt}
          onToggleBookmark={handleToggleBookmark}
          onSaveNote={handleSaveNote}
        />
      )}

      {activeTab === 'practice' && (
        <PracticePage
          key={activeCourse.id}
          course={activeCourse}
          state={state}
          stats={stats}
          onStartSession={handleStartSession}
          onUpdateSessionSelection={handleUpdateSessionSelection}
          onCheckPracticeQuestion={handleCheckPracticeQuestion}
          onSetCurrentQuestion={handleSetCurrentSessionQuestion}
          onFinishPracticeSession={() => handleSubmitActiveSession(false)}
          onExitSession={handleExitSession}
          onToggleBookmark={handleToggleBookmark}
          onSaveNote={handleSaveNote}
        />
      )}

      {activeTab === 'exam' && (
        <ExamPage
          key={activeCourse.id}
          course={activeCourse}
          state={state}
          stats={stats}
          onStartSession={handleStartSession}
          onUpdateSessionSelection={handleUpdateSessionSelection}
          onToggleExamFlag={handleToggleExamFlag}
          onSetCurrentQuestion={handleSetCurrentSessionQuestion}
          onSubmitExam={handleSubmitActiveSession}
          onRestartExamFromBeginning={handleRestartExamFromBeginning}
          onExitSession={handleExitSession}
          onToggleBookmark={handleToggleBookmark}
          onSaveNote={handleSaveNote}
          onSaveCustomPack={handleSaveCustomPack}
          onDeleteCustomPack={handleDeleteCustomPack}
        />
      )}

      {activeTab === 'review' && (
        <ReviewPage
          key={activeCourse.id}
          course={activeCourse}
          state={state}
          stats={stats}
          onOpenQuestionInStudy={(qId, filter = 'all') =>
            handleOpenStudyWithFilter(filter, qId)
          }
          onStartQuickPractice={handleStartQuickPracticeFromReview}
        />
      )}

      {activeTab === 'library' && (
        <LibraryBackupPage
          key={activeCourse.id}
          course={activeCourse}
          state={state}
          stats={stats}
          storageStatus={storageStatus}
          onImportBackup={handleImportBackup}
          onResetCourseProgress={handleResetAllProgress}
          onOpenQuestionInStudy={(qId) => handleOpenStudyWithFilter('all', qId)}
        />
      )}

      {activeTab === 'admin' && authSession.user.role === 'admin' && (
        <AdminDashboardPage
          token={authSession.token}
          onOpenQuestionInStudy={(qId) => handleOpenStudyWithFilter('all', qId)}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        currentGuestProgress={state}
      />
    </Layout>
  );
};

export default App;
