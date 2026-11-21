import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyBackupImport,
  createInitialProgressState,
  loadProgressState,
  markQuestionViewed,
  recordSingleQuestionAttempt,
  saveProgressState,
  StorageStatus,
  submitActiveSessionIdempotent,
  toggleQuestionBookmark,
  updateQuestionNote,
} from './lib/storage';
import { computeAggregateStats } from './lib/stats';
import { createSessionFromPool } from './lib/session';
import type {
  ActiveSession,
  AppProgressState,
  BackupPayload,
  NavigationTab,
  QuestionFilterType,
} from './types';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { StudyPage } from './pages/StudyPage';
import { PracticePage } from './pages/PracticePage';
import { ExamPage } from './pages/ExamPage';
import { ReviewPage } from './pages/ReviewPage';
import { LibraryBackupPage } from './pages/LibraryBackupPage';

const THEME_STORAGE_KEY = 'ccdv_f_theme_dark';

export const App: React.FC = () => {
  const [{ state, storageStatus }, setAppStore] = useState<{
    state: AppProgressState;
    storageStatus: StorageStatus;
  }>(() => loadProgressState());

  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    // If there is an active in-progress exam or practice session on page reload, restore its tab!
    const loaded = loadProgressState().state;
    if (loaded.activeSession && loaded.activeSession.status === 'in_progress') {
      if (loaded.activeSession.mode === 'exam') return 'exam';
      if (loaded.activeSession.mode === 'practice') return 'practice';
    }
    return 'overview';
  });

  const [studyFilterTarget, setStudyFilterTarget] = useState<{
    filter: QuestionFilterType;
    questionId?: string;
    tag?: string;
  }>({ filter: 'all' });

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

  const updateStateAndPersist = useCallback(
    (updater: (prev: AppProgressState) => AppProgressState) => {
      setAppStore((current) => {
        const nextState = updater(current.state);
        if (nextState === current.state) return current;
        const saveRes = saveProgressState(nextState);
        return {
          state: nextState,
          storageStatus: saveRes,
        };
      });
    },
    []
  );

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
      updateStateAndPersist((prev) => ({
        ...prev,
        activeSession: session,
      }));
      if (session.mode === 'exam') {
        setActiveTab('exam');
      } else if (session.mode === 'practice') {
        setActiveTab('practice');
      }
    },
    [updateStateAndPersist]
  );

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
      setStudyFilterTarget({ filter, questionId, tag });
      setActiveTab('study');
    },
    []
  );

  const handleResumeActiveSession = useCallback(() => {
    if (!state.activeSession) return;
    if (state.activeSession.mode === 'exam') {
      setActiveTab('exam');
    } else if (state.activeSession.mode === 'practice') {
      setActiveTab('practice');
    } else {
      setActiveTab('study');
    }
  }, [state.activeSession]);

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

  const handleImportBackup = useCallback(
    (payload: BackupPayload, mode: 'replace' | 'merge') => {
      updateStateAndPersist((prev) => applyBackupImport(prev, payload, mode));
    },
    [updateStateAndPersist]
  );

  const handleResetAllProgress = useCallback(() => {
    updateStateAndPersist(() => createInitialProgressState());
  }, [updateStateAndPersist]);

  return (
    <Layout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((d) => !d)}
      dueCount={stats.dueForReviewCount}
      wrongLatestCount={stats.wrongLatestCount}
      activeSession={state.activeSession}
      onResumeActiveSession={handleResumeActiveSession}
      storageStatus={storageStatus}
    >
      {activeTab === 'overview' && (
        <OverviewPage
          state={state}
          stats={stats}
          onNavigateTab={setActiveTab}
          onOpenStudyWithFilter={handleOpenStudyWithFilter}
          onResumeActiveSession={handleResumeActiveSession}
          onDiscardActiveSession={handleExitSession}
        />
      )}

      {activeTab === 'study' && (
        <StudyPage
          state={state}
          stats={stats}
          initialFilter={studyFilterTarget.filter}
          initialQuestionId={studyFilterTarget.questionId}
          initialDerivedTag={studyFilterTarget.tag}
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
          onExitSession={handleExitSession}
          onToggleBookmark={handleToggleBookmark}
          onSaveNote={handleSaveNote}
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

      {activeTab === 'library' && (
        <LibraryBackupPage
          state={state}
          stats={stats}
          storageStatus={storageStatus}
          onOpenQuestionInStudy={(qId) => handleOpenStudyWithFilter('all', qId)}
          onImportBackup={handleImportBackup}
          onResetAllProgress={handleResetAllProgress}
        />
      )}
    </Layout>
  );
};

export default App;
