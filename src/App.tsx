import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  apiFetchMe,
  apiSendHeartbeat,
  apiSyncProgress,
  loadStoredAuthSession,
  reconcileUserProgress,
  saveStoredAuthSession,
} from './lib/auth';
import {
  createInitialProgressState,
  deleteCustomExamPack,
  loadProgressState,
  markQuestionViewed,
  recordSingleQuestionAttempt,
  saveProgressState,
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
import { AdminDashboardPage } from './pages/AdminDashboardPage';

const THEME_STORAGE_KEY = 'ccdv_f_theme_dark';

export const App: React.FC = () => {
  const [authSession, setAuthSession] = useState<{
    token: string;
    user: AuthUser;
  } | null>(() => loadStoredAuthSession());

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [cloudSynced, setCloudSynced] = useState<boolean>(false);

  const currentUsername = authSession?.user?.username || null;

  const [{ state, storageStatus }, setAppStore] = useState<{
    state: AppProgressState;
    storageStatus: StorageStatus;
  }>(() => loadProgressState(loadStoredAuthSession()?.user?.username));

  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    const storedAuth = loadStoredAuthSession();
    const loaded = loadProgressState(storedAuth?.user?.username).state;
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

  // Verify auth session with server and reconcile cloud progress on mount
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
        if (res.progress) {
          setAppStore((current) => {
            const merged = reconcileUserProgress(current.state, res.progress);
            const saveRes = saveProgressState(merged, res.user!.username);
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
  }, [authSession?.token]);

  const syncTimeoutRef = useRef<number | null>(null);

  // Build human-readable activity description for live admin telemetry
  const currentActivityDescription = useMemo(() => {
    const sess = state.activeSession;
    if (activeTab === 'exam' && sess && sess.mode === 'exam' && sess.status === 'in_progress') {
      const idx = sess.questionOrder.indexOf(sess.currentQuestionId) + 1;
      const ans = Object.keys(sess.selections || {}).length;
      return `Đang Thi thử: Câu ${idx}/${sess.questionOrder.length} (Đã chọn ${ans} câu)`;
    }
    if (
      activeTab === 'practice' &&
      sess &&
      sess.mode === 'practice' &&
      sess.status === 'in_progress'
    ) {
      const idx = sess.questionOrder.indexOf(sess.currentQuestionId) + 1;
      return `Đang Luyện tập: Câu ${idx}/${sess.questionOrder.length}`;
    }
    if (activeTab === 'study') {
      const curQ =
        state.studyProgress?.currentQuestionId || state.lastStudiedQuestionId || 'ccdv-f-q001';
      return `Đang Học từng câu (${curQ})`;
    }
    if (activeTab === 'review') return 'Đang xem Lịch ôn & Câu sai';
    if (activeTab === 'admin') return 'Đang mở Admin Dashboard';
    return 'Đang xem Tổng quan';
  }, [
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
        const saveRes = saveProgressState(nextState, currentUsername);
        scheduleCloudSync(nextState, authSession?.token || null);
        return {
          state: nextState,
          storageStatus: saveRes,
        };
      });
    },
    [currentUsername, authSession?.token, scheduleCloudSync]
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
      dbConnected: boolean;
    }) => {
      const nextAuth = { token: params.token, user: params.user };
      saveStoredAuthSession(nextAuth);
      setAuthSession(nextAuth);
      setCloudSynced(params.dbConnected);

      // Load this user's isolated local state and reconcile with their MongoDB server progress
      const userLocal = loadProgressState(params.user.username).state;
      const merged = reconcileUserProgress(userLocal, params.serverProgress);
      const saveRes = saveProgressState(merged, params.user.username);
      setAppStore({ state: merged, storageStatus: saveRes });

      // Sync merged progress back to server so MongoDB always has the latest snapshot
      apiSyncProgress(params.token, merged).catch(() => {});

      if (params.user.role === 'admin') {
        setActiveTab('admin');
      } else if (merged.activeSession?.status === 'in_progress') {
        setActiveTab(merged.activeSession.mode === 'exam' ? 'exam' : 'practice');
      } else if (merged.lastActiveTab && merged.lastActiveTab !== 'admin') {
        setActiveTab(merged.lastActiveTab);
      } else {
        setActiveTab('overview');
      }
    },
    []
  );

  const handleLogout = useCallback(() => {
    saveStoredAuthSession(null);
    setAuthSession(null);
    setCloudSynced(false);
    const guestLoaded = loadProgressState(null);
    setAppStore(guestLoaded);
    setActiveTab('overview');
  }, []);

  const stats = useMemo(() => computeAggregateStats(state), [state]);

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
        const base = prev.studyProgress || getDefaultStudyProgress(prev.lastStudiedQuestionId);
        const nextStudy = updater(base);
        return {
          ...prev,
          studyProgress: nextStudy,
          lastStudiedQuestionId: nextStudy.currentQuestionId,
        };
      });
    },
    [updateStateAndPersist]
  );

  const handleResetStudyPassOnly = useCallback(() => {
    updateStateAndPersist((prev) => ({
      ...prev,
      studyProgress: getDefaultStudyProgress('ccdv-f-q001'),
      lastStudiedQuestionId: 'ccdv-f-q001',
    }));
  }, [updateStateAndPersist]);

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
      setExternalStudyOverride({ filter, questionId, tag, nonce: Date.now() });
      handleSelectTab('study');
    },
    [handleSelectTab]
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
      });
      if (res.session) {
        handleStartSession(res.session);
      }
    },
    [stats, handleStartSession]
  );

  const handleResetAllProgress = useCallback(() => {
    updateStateAndPersist(() => ({
      ...createInitialProgressState(),
      studyProgress: getDefaultStudyProgress('ccdv-f-q001'),
      lastActiveTab: activeTab,
    }));
  }, [updateStateAndPersist, activeTab]);

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
          state={state}
          stats={stats}
          onOpenQuestionInStudy={(qId, filter = 'all') =>
            handleOpenStudyWithFilter(filter, qId)
          }
          onStartQuickPractice={handleStartQuickPracticeFromReview}
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
