import React, { useEffect, useMemo, useState } from 'react';
import {
  Filter,
  Grid,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ALL_DERIVED_TAGS, QUESTIONS, QUESTIONS_BY_ID } from '../data/questionBank';
import { AggregateStats, filterQuestions } from '../lib/stats';
import { FILTER_LABELS } from '../lib/session';
import type { AppProgressState, QuestionFilterType } from '../types';
import { QuestionCard } from '../components/QuestionCard';
import { buildGridItemsForStudy, QuestionGridDrawer } from '../components/QuestionGridDrawer';

interface StudyPageProps {
  state: AppProgressState;
  stats: AggregateStats;
  initialFilter?: QuestionFilterType;
  initialQuestionId?: string;
  initialDerivedTag?: string;
  onMarkViewed: (questionId: string) => void;
  onRecordAttempt: (params: {
    questionId: string;
    selectedOptionIds: string[];
    revealedBeforeCheck: boolean;
  }) => void;
  onToggleBookmark: (questionId: string) => void;
  onSaveNote: (questionId: string, note: string) => void;
}

export const StudyPage: React.FC<StudyPageProps> = ({
  state,
  stats,
  initialFilter = 'all',
  initialQuestionId,
  initialDerivedTag = 'all',
  onMarkViewed,
  onRecordAttempt,
  onToggleBookmark,
  onSaveNote,
}) => {
  const [filterType, setFilterType] = useState<QuestionFilterType>(initialFilter);
  const [derivedTag, setDerivedTag] = useState<string>(initialDerivedTag);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentQuestionId, setCurrentQuestionId] = useState<string>(
    initialQuestionId || state.lastStudiedQuestionId || 'ccdv-f-q001'
  );

  // Sync when parent passes a new filter/question target
  useEffect(() => {
    setFilterType(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    setDerivedTag(initialDerivedTag);
  }, [initialDerivedTag]);

  useEffect(() => {
    if (initialQuestionId && QUESTIONS_BY_ID[initialQuestionId]) {
      setCurrentQuestionId(initialQuestionId);
    }
  }, [initialQuestionId]);

  // Per-question transient UI state in Study Mode:
  // By default, when opening a question in Study mode, answers and explanations are HIDDEN
  // until the user selects options and clicks "Kiểm tra đáp án" (or clicks "Xem đáp án trước").
  const [selectionsByQuestion, setSelectionsByQuestion] = useState<Record<string, string[]>>({});
  const [checkedOrRevealedByQuestion, setCheckedOrRevealedByQuestion] = useState<
    Record<string, { checked: boolean; revealedBeforeCheck: boolean }>
  >({});
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

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
        setCurrentQuestionId(filteredQuestions[0].id);
      }
    }
  }, [filteredQuestions, currentQuestionId]);

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
    ? selectionsByQuestion[currentQuestion.id] || []
    : [];

  const turnStatus = currentQuestion
    ? checkedOrRevealedByQuestion[currentQuestion.id] || {
        checked: false,
        revealedBeforeCheck: false,
      }
    : { checked: false, revealedBeforeCheck: false };

  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion || turnStatus.checked) return;
    const isMulti = currentQuestion.interaction.type === 'multiple_choice';
    setSelectionsByQuestion((prev) => {
      const current = prev[currentQuestion.id] || [];
      if (!isMulti) {
        return { ...prev, [currentQuestion.id]: [optionId] };
      }
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [currentQuestion.id]: next };
    });
  };

  const handleCheckAnswer = () => {
    if (!currentQuestion || selectedOptions.length === 0 || turnStatus.checked) return;
    setCheckedOrRevealedByQuestion((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        checked: true,
        revealedBeforeCheck: false,
      },
    }));
    onRecordAttempt({
      questionId: currentQuestion.id,
      selectedOptionIds: selectedOptions,
      revealedBeforeCheck: false,
    });
  };

  const handleRevealBeforeCheck = () => {
    if (!currentQuestion || turnStatus.checked) return;
    setCheckedOrRevealedByQuestion((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        checked: true,
        revealedBeforeCheck: true,
      },
    }));
    onRecordAttempt({
      questionId: currentQuestion.id,
      selectedOptionIds: selectedOptions,
      revealedBeforeCheck: true,
    });
  };

  const handleRetryNewTurn = () => {
    if (!currentQuestion) return;
    setSelectionsByQuestion((prev) => ({
      ...prev,
      [currentQuestion.id]: [],
    }));
    setCheckedOrRevealedByQuestion((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        checked: false,
        revealedBeforeCheck: false,
      },
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
      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã câu (vd: q078) hoặc nội dung tiếng Anh..."
              aria-label="Tìm kiếm câu hỏi"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
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
              onChange={(e) => setFilterType(e.target.value as QuestionFilterType)}
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
              onChange={(e) => setDerivedTag(e.target.value)}
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

        {/* Filter Status Bar & Mobile Grid Trigger */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Hiển thị <strong>{filteredQuestions.length}</strong> / 110 câu hỏi
            </span>
            {qMeta && qMeta.isAnswered && (
              <>
                <span>•</span>
                <span>
                  Lịch sử câu <code className="font-mono">{currentQuestion?.id}</code>: Đã làm{' '}
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
            onClick={() => {
              setFilterType('all');
              setDerivedTag('all');
              setSearchQuery('');
            }}
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

            {/* Anti-spoiler & Client-side Data Transparency Notice */}
            <div className="px-4 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <span>
                <strong>Chế độ chống lộ đáp án:</strong> Toàn bộ đáp án đúng và giải thích được ẩn hoàn
                toàn khỏi cây DOM cho tới khi bạn bấm <em>Kiểm tra đáp án</em> hoặc{' '}
                <em>Xem đáp án trước</em>. Lưu ý: vì ứng dụng chạy tĩnh hoàn toàn phía client (offline
                first), dữ liệu ngân hàng đề vẫn nằm trong bundle trình duyệt và có thể đọc bằng
                DevTools.
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
    </div>
  );
};
