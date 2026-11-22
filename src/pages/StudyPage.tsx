import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Filter,
  Grid,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { ALL_DERIVED_TAGS, QUESTIONS, QUESTIONS_BY_ID } from '../data/questionBank';
import { AggregateStats, filterQuestions } from '../lib/stats';
import { FILTER_LABELS } from '../lib/session';
import type {
  AppProgressState,
  QuestionFilterType,
  StudySessionProgress,
} from '../types';
import { QuestionCard } from '../components/QuestionCard';
import { buildGridItemsForStudy, QuestionGridDrawer } from '../components/QuestionGridDrawer';

interface StudyPageProps {
  state: AppProgressState;
  stats: AggregateStats;
  externalFilterOverride?: {
    filter: QuestionFilterType;
    questionId?: string;
    tag?: string;
    nonce: number;
  } | null;
  onUpdateStudyProgress: (updater: (prev: StudySessionProgress) => StudySessionProgress) => void;
  onResetStudyPassOnly: () => void;
  onResetAllProgress: () => void;
  onMarkViewed: (questionId: string) => void;
  onRecordAttempt: (params: {
    questionId: string;
    selectedOptionIds: string[];
    revealedBeforeCheck: boolean;
  }) => void;
  onToggleBookmark: (questionId: string) => void;
  onSaveNote: (questionId: string, note: string) => void;
}

export function getDefaultStudyProgress(lastQuestionId?: string | null): StudySessionProgress {
  return {
    currentQuestionId:
      lastQuestionId && QUESTIONS_BY_ID[lastQuestionId] ? lastQuestionId : 'ccdv-f-q001',
    filterType: 'all',
    derivedTag: 'all',
    searchQuery: '',
    selectionsByQuestion: {},
    checkedByQuestion: {},
    updatedAt: new Date().toISOString(),
  };
}

export const StudyPage: React.FC<StudyPageProps> = ({
  state,
  stats,
  externalFilterOverride,
  onUpdateStudyProgress,
  onResetStudyPassOnly,
  onResetAllProgress,
  onMarkViewed,
  onRecordAttempt,
  onToggleBookmark,
  onSaveNote,
}) => {
  const studyProgress = useMemo(
    () => state.studyProgress || getDefaultStudyProgress(state.lastStudiedQuestionId),
    [state.studyProgress, state.lastStudiedQuestionId]
  );

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);

  // Apply explicit navigation jump from Overview/Review/Admin (only when nonce changes)
  useEffect(() => {
    if (!externalFilterOverride) return;
    onUpdateStudyProgress((prev) => ({
      ...prev,
      filterType: externalFilterOverride.filter,
      derivedTag: externalFilterOverride.tag ?? 'all',
      searchQuery: '',
      currentQuestionId:
        externalFilterOverride.questionId && QUESTIONS_BY_ID[externalFilterOverride.questionId]
          ? externalFilterOverride.questionId
          : prev.currentQuestionId,
      updatedAt: new Date().toISOString(),
    }));
  }, [externalFilterOverride?.nonce]);

  const { filterType, derivedTag, searchQuery, currentQuestionId } = studyProgress;

  const filteredQuestions = useMemo(
    () =>
      filterQuestions(QUESTIONS, stats, {
        filterType,
        derivedTag,
        searchQuery,
      }),
    [stats, filterType, derivedTag, searchQuery]
  );

  // Ensure currentQuestionId belongs to filteredQuestions when filter changes
  useEffect(() => {
    if (filteredQuestions.length > 0) {
      const exists = filteredQuestions.some((q) => q.id === currentQuestionId);
      if (!exists) {
        onUpdateStudyProgress((prev) => ({
          ...prev,
          currentQuestionId: filteredQuestions[0].id,
          updatedAt: new Date().toISOString(),
        }));
      }
    }
  }, [filteredQuestions, currentQuestionId, onUpdateStudyProgress]);

  const currentQuestion = QUESTIONS_BY_ID[currentQuestionId] || filteredQuestions[0] || null;

  // Record view (distinct from answering!) whenever currentQuestion changes
  useEffect(() => {
    if (currentQuestion) {
      onMarkViewed(currentQuestion.id);
    }
  }, [currentQuestion?.id]);

  const currentIndex = useMemo(
    () =>
      currentQuestion
        ? filteredQuestions.findIndex((q) => q.id === currentQuestion.id)
        : -1,
    [filteredQuestions, currentQuestion]
  );

  const selectedOptions = currentQuestion
    ? studyProgress.selectionsByQuestion[currentQuestion.id] || []
    : [];

  const turnStatus = currentQuestion
    ? studyProgress.checkedByQuestion[currentQuestion.id] || {
        checked: false,
        revealedBeforeCheck: false,
      }
    : { checked: false, revealedBeforeCheck: false };

  const checkedInPassCount = Object.values(studyProgress.checkedByQuestion).filter(
    (x) => x.checked
  ).length;

  const setCurrentQuestionId = (qId: string) => {
    onUpdateStudyProgress((prev) => ({
      ...prev,
      currentQuestionId: qId,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion || turnStatus.checked) return;
    const isMulti = currentQuestion.interaction.type === 'multiple_choice';
    onUpdateStudyProgress((prev) => {
      const current = prev.selectionsByQuestion[currentQuestion.id] || [];
      const next = !isMulti
        ? [optionId]
        : current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];

      return {
        ...prev,
        selectionsByQuestion: {
          ...prev.selectionsByQuestion,
          [currentQuestion.id]: next,
        },
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleCheckAnswer = () => {
    if (!currentQuestion || selectedOptions.length === 0 || turnStatus.checked) return;
    onUpdateStudyProgress((prev) => ({
      ...prev,
      checkedByQuestion: {
        ...prev.checkedByQuestion,
        [currentQuestion.id]: {
          checked: true,
          revealedBeforeCheck: false,
        },
      },
      updatedAt: new Date().toISOString(),
    }));
    onRecordAttempt({
      questionId: currentQuestion.id,
      selectedOptionIds: selectedOptions,
      revealedBeforeCheck: false,
    });
  };

  const handleRevealBeforeCheck = () => {
    if (!currentQuestion || turnStatus.checked) return;
    onUpdateStudyProgress((prev) => ({
      ...prev,
      checkedByQuestion: {
        ...prev.checkedByQuestion,
        [currentQuestion.id]: {
          checked: true,
          revealedBeforeCheck: true,
        },
      },
      updatedAt: new Date().toISOString(),
    }));
    onRecordAttempt({
      questionId: currentQuestion.id,
      selectedOptionIds: selectedOptions,
      revealedBeforeCheck: true,
    });
  };

  const handleRetryNewTurn = () => {
    if (!currentQuestion) return;
    onUpdateStudyProgress((prev) => ({
      ...prev,
      selectionsByQuestion: {
        ...prev.selectionsByQuestion,
        [currentQuestion.id]: [],
      },
      checkedByQuestion: {
        ...prev.checkedByQuestion,
        [currentQuestion.id]: {
          checked: false,
          revealedBeforeCheck: false,
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const gridItems = useMemo(
    () =>
      buildGridItemsForStudy(
        filteredQuestions.map((q) => q.id),
        stats.perQuestion
      ),
    [filteredQuestions, stats.perQuestion]
  );

  const qMeta = currentQuestion ? stats.perQuestion[currentQuestion.id] : null;

  return (
    <div className="space-y-5">
      {/* Filter, Search & Persistent Stage / Reset Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) =>
                onUpdateStudyProgress((prev) => ({
                  ...prev,
                  searchQuery: e.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
              placeholder="Tìm theo mã câu (vd: q078) hoặc nội dung tiếng Anh..."
              aria-label="Tìm kiếm câu hỏi"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() =>
                  onUpdateStudyProgress((prev) => ({
                    ...prev,
                    searchQuery: '',
                    updatedAt: new Date().toISOString(),
                  }))
                }
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter Select */}
          <div className="md:col-span-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={filterType}
              onChange={(e) =>
                onUpdateStudyProgress((prev) => ({
                  ...prev,
                  filterType: e.target.value as QuestionFilterType,
                  updatedAt: new Date().toISOString(),
                }))
              }
              aria-label="Lọc theo trạng thái câu hỏi"
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {(Object.keys(FILTER_LABELS) as QuestionFilterType[]).map((key) => (
                <option key={key} value={key}>
                  {FILTER_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {/* Derived Learning Tag Filter */}
          <div className="md:col-span-3">
            <select
              value={derivedTag}
              onChange={(e) =>
                onUpdateStudyProgress((prev) => ({
                  ...prev,
                  derivedTag: e.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
              aria-label="Lọc theo Nhãn hỗ trợ học tập"
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Tất cả nhãn hỗ trợ học tập</option>
              {ALL_DERIVED_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  Nhãn: {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Bar + Auto-Save Indicator + Reset Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Hiển thị <strong>{filteredQuestions.length}</strong> / 110 câu • Tự động lưu giai đoạn
              hiện tại (đã chấm lượt này: <strong>{checkedInPassCount}</strong> câu)
            </span>
            {qMeta && qMeta.isAnswered && (
              <>
                <span>•</span>
                <span>
                  Câu <code className="font-mono">{currentQuestion?.id}</code>: Đã làm{' '}
                  <strong>{qMeta.attemptsCount} lượt</strong> (Gần nhất:{' '}
                  <strong
                    className={
                      qMeta.isLatestAttemptCorrectUnassisted
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : qMeta.isLatestAttemptAssisted
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {qMeta.isLatestAttemptCorrectUnassisted
                      ? 'Đúng tự lực'
                      : qMeta.isLatestAttemptAssisted
                      ? 'Đã xem đáp án'
                      : 'Sai'}
                  </strong>
                  )
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors"
              title="Làm lại từ đầu (Reset lượt học hoặc toàn bộ tiến độ)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm lại từ đầu (Reset)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Danh sách câu ({filteredQuestions.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content + Desktop Grid Sidebar */}
      {filteredQuestions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-base font-bold text-slate-800 dark:text-slate-200">
            Không có câu hỏi nào khớp với bộ lọc hiện tại
          </p>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Hãy thử đổi bộ lọc trạng thái hoặc xóa từ khóa tìm kiếm để xem toàn bộ 110 câu hỏi.
          </p>
          <button
            type="button"
            onClick={() =>
              onUpdateStudyProgress((prev) => ({
                ...prev,
                filterType: 'all',
                derivedTag: 'all',
                searchQuery: '',
                updatedAt: new Date().toISOString(),
              }))
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700"
          >
            Đặt lại bộ lọc (Xem đủ 110 câu)
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-6">
          <div className="flex-1 min-w-0 w-full space-y-4">
            {currentQuestion && (
              <QuestionCard
                question={currentQuestion}
                mode="study"
                selectedOptionIds={selectedOptions}
                isSubmittedOrRevealed={turnStatus.checked}
                revealedBeforeCheck={turnStatus.revealedBeforeCheck}
                isLocked={turnStatus.checked}
                isBookmarked={Boolean(state.bookmarks[currentQuestion.id])}
                noteText={state.notes[currentQuestion.id] || ''}
                questionIndex={currentIndex}
                totalQuestionsInView={filteredQuestions.length}
                onSelectOption={handleSelectOption}
                onCheckAnswer={handleCheckAnswer}
                onRevealAnswerBeforeCheck={handleRevealBeforeCheck}
                onRetryQuestion={handleRetryNewTurn}
                onToggleBookmark={() => onToggleBookmark(currentQuestion.id)}
                onSaveNote={(note) => onSaveNote(currentQuestion.id, note)}
                hasPrev={currentIndex > 0}
                hasNext={currentIndex >= 0 && currentIndex < filteredQuestions.length - 1}
                onPrevQuestion={() => {
                  if (currentIndex > 0) {
                    setCurrentQuestionId(filteredQuestions[currentIndex - 1].id);
                  }
                }}
                onNextQuestion={() => {
                  if (currentIndex >= 0 && currentIndex < filteredQuestions.length - 1) {
                    setCurrentQuestionId(filteredQuestions[currentIndex + 1].id);
                  }
                }}
              />
            )}

            {/* Auto-save transparency notice */}
            <div className="px-4 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <span>
                <strong>Tự động lưu vị trí & đáp án đang làm:</strong> Nếu bạn tắt trình duyệt hoặc
                đổi thiết bị, lần vào lại sẽ mở đúng câu hỏi và lựa chọn bạn đang làm dở. Muốn học/thi
                lại từ Câu 1, bấm nút <strong>Làm lại từ đầu (Reset)</strong> ở góc trên bên phải.
              </span>
            </div>
          </div>

          <QuestionGridDrawer
            items={gridItems}
            currentQuestionId={currentQuestion?.id || ''}
            onSelectQuestion={(id) => setCurrentQuestionId(id)}
            isOpenMobile={isMobileDrawerOpen}
            onCloseMobile={() => setIsMobileDrawerOpen(false)}
            title="Danh sách câu đang lọc"
          />
        </div>
      )}

      {/* Reset Options Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-reset-title"
        >
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="study-reset-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Làm lại từ đầu (Reset)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Chọn cách reset phù hợp với nhu cầu ôn tập của bạn:
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  onResetStudyPassOnly();
                  setShowResetModal(false);
                }}
                className="w-full text-left p-3.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-950/30 hover:bg-brand-100/70 transition-colors"
              >
                <div className="font-bold text-sm text-brand-900 dark:text-brand-200 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  <span>1. Làm lại lượt Học từng câu từ Câu 1</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Xóa sạch các lựa chọn đang làm dở trong lượt học này và quay về{' '}
                  <code className="font-mono">ccdv-f-q001</code>. Vẫn giữ lại lịch sử thống kê và ghi
                  chú cũ.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  onResetAllProgress();
                  setShowResetModal(false);
                }}
                className="w-full text-left p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100/70 transition-colors"
              >
                <div className="font-bold text-sm text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  <span>2. Reset toàn bộ tiến độ về 0 / 110 câu</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Xóa toàn bộ lịch sử trả lời, đề thi cũ và bắt đầu lại hoàn toàn như mới từ Câu 1.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
