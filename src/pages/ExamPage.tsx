import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Flag,
  Grid,
  Info,
  Play,
  RotateCcw,
  Send,
  Shuffle,
  Timer,
  XCircle,
} from 'lucide-react';
import { QUESTIONS_BY_ID } from '../data/questionBank';
import {
  createSessionFromPool,
  formatCountdown,
  getFilteredPool,
  getRemainingSeconds,
} from '../lib/session';
import type { AggregateStats } from '../lib/stats';
import type {
  ActiveSession,
  AppProgressState,
  QuestionFilterType,
} from '../types';
import { QuestionCard } from '../components/QuestionCard';
import { QuestionGridDrawer, QuestionGridItem } from '../components/QuestionGridDrawer';

interface ExamPageProps {
  state: AppProgressState;
  stats: AggregateStats;
  onStartSession: (session: ActiveSession) => void;
  onUpdateSessionSelection: (questionId: string, selectedOptionIds: string[]) => void;
  onToggleExamFlag: (questionId: string) => void;
  onSetCurrentQuestion: (questionId: string) => void;
  onSubmitExam: (autoSubmittedByTimeout?: boolean) => void;
  onExitSession: () => void;
  onToggleBookmark: (questionId: string) => void;
  onSaveNote: (questionId: string, note: string) => void;
}

export const ExamPage: React.FC<ExamPageProps> = ({
  state,
  stats,
  onStartSession,
  onUpdateSessionSelection,
  onToggleExamFlag,
  onSetCurrentQuestion,
  onSubmitExam,
  onExitSession,
  onToggleBookmark,
  onSaveNote,
}) => {
  const [filterType, setFilterType] = useState<QuestionFilterType>('all');
  const [questionCount, setQuestionCount] = useState<number>(30);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [targetScorePercent, setTargetScorePercent] = useState<number>(80);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const activeExamSession =
    state.activeSession && state.activeSession.mode === 'exam'
      ? state.activeSession
      : null;

  const isCompleted = activeExamSession?.status === 'completed';

  // Live countdown calculated from absolute deadline via Date.now()
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() =>
    activeExamSession && activeExamSession.status === 'in_progress'
      ? getRemainingSeconds(activeExamSession.deadline)
      : null
  );

  const autoSubmitTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeExamSession || activeExamSession.status !== 'in_progress' || !activeExamSession.deadline) {
      setRemainingSeconds(null);
      return;
    }

    const updateTimer = () => {
      const rem = getRemainingSeconds(activeExamSession.deadline, Date.now());
      setRemainingSeconds(rem);
      if (rem !== null && rem <= 0 && autoSubmitTriggeredRef.current !== activeExamSession.id) {
        autoSubmitTriggeredRef.current = activeExamSession.id;
        setShowConfirmModal(false);
        onSubmitExam(true);
      }
    };

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 500);
    const handleVisibility = () => updateTimer();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [activeExamSession?.id, activeExamSession?.status, activeExamSession?.deadline, onSubmitExam]);

  const availablePool = useMemo(
    () => getFilteredPool(stats, filterType, 'all'),
    [stats, filterType]
  );

  const availableCount = availablePool.length;
  const effectiveCount = Math.min(Math.max(1, questionCount), availableCount);

  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createSessionFromPool(stats, {
      mode: 'exam',
      filterType,
      requestedCount: questionCount,
      shuffleQuestions,
      durationMinutes,
      targetScorePercent,
    });
    if (res.session) {
      autoSubmitTriggeredRef.current = null;
      onStartSession(res.session);
    }
  };

  if (activeExamSession) {
    const order = activeExamSession.questionOrder;
    const currentQId = activeExamSession.currentQuestionId || order[0];
    const currentQuestion = QUESTIONS_BY_ID[currentQId];
    const currentIndex = order.indexOf(currentQId);

    const answeredCount = order.filter(
      (qId) => (activeExamSession.selections[qId] || []).length > 0
    ).length;
    const unansweredCount = order.length - answeredCount;
    const flaggedCount = order.filter((qId) => activeExamSession.flaggedQuestions[qId]).length;

    const checkedMap = activeExamSession.checkedQuestions;
    const correctCount = Object.values(checkedMap).filter((c) => c.isCorrect).length;
    const scorePercent =
      order.length > 0 ? Math.round((correctCount / order.length) * 1000) / 10 : 0;
    const targetPct = activeExamSession.targetScorePercent ?? 80;
    const isPassed = scorePercent >= targetPct;

    const gridItems: QuestionGridItem[] = order.map((qId, idx) => {
      const sel = activeExamSession.selections[qId] || [];
      const check = checkedMap[qId];
      let status: QuestionGridItem['status'] = 'unanswered';
      if (isCompleted && check) {
        status = check.isCorrect ? 'correct' : 'wrong';
      } else if (sel.length > 0) {
        status = 'answered_pending';
      }
      return {
        id: qId,
        number: idx + 1,
        label: `${idx + 1}`,
        status,
        isFlagged: Boolean(activeExamSession.flaggedQuestions[qId]),
        isBookmarked: Boolean(state.bookmarks[qId]),
      };
    });

    const selectedOptions = activeExamSession.selections[currentQId] || [];

    const handleSelectOption = (optionId: string) => {
      if (!currentQuestion || isCompleted) return;
      const isMulti = currentQuestion.interaction.type === 'multiple_choice';
      if (!isMulti) {
        onUpdateSessionSelection(currentQId, [optionId]);
      } else {
        const next = selectedOptions.includes(optionId)
          ? selectedOptions.filter((id) => id !== optionId)
          : [...selectedOptions, optionId];
        onUpdateSessionSelection(currentQId, next);
      }
    };

    const isLowTime = remainingSeconds !== null && remainingSeconds <= 300;

    return (
      <div className="space-y-6">
        {/* Sticky Exam Control Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                Thi thử • Cấu hình luyện tập
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {activeExamSession.title}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              <span>
                Đã trả lời: <strong>{answeredCount}</strong>/{order.length}
              </span>
              <span
                className={
                  unansweredCount > 0
                    ? 'text-amber-700 dark:text-amber-400 font-semibold'
                    : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                }
              >
                • Chưa trả lời: {unansweredCount} câu
              </span>
              {flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <Flag className="w-3 h-3 fill-current" />
                  Đánh dấu xem lại: {flaggedCount}
                </span>
              )}
              <span>• Ngưỡng mục tiêu: {targetPct}%</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isCompleted && remainingSeconds !== null && (
              <div
                role="timer"
                aria-label="Thời gian còn lại"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-base font-bold border ${
                  isLowTime
                    ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 animate-pulse'
                    : 'bg-slate-100 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatCountdown(remainingSeconds)}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Lưới câu ({order.length})</span>
            </button>

            {!isCompleted ? (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Nộp bài</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onExitSession}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Tạo đề thi thử mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Completed Exam Result Banner */}
        {isCompleted && (
          <div
            className={`p-6 rounded-2xl border shadow-md ${
              isPassed
                ? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 border-emerald-700/60 text-white'
                : 'bg-gradient-to-br from-rose-950 via-slate-900 to-rose-900 border-rose-700/60 text-white'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10">
                  {isPassed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">
                        ĐẠT NGƯỠNG MỤC TIÊU ({targetPct}%)
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-rose-300">
                        CHƯA ĐẠT NGƯỠNG MỤC TIÊU ({targetPct}%)
                      </span>
                    </>
                  )}
                  {activeExamSession.autoSubmittedByTimeout && (
                    <span className="text-amber-300">• Tự động nộp khi hết giờ</span>
                  )}
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold">
                  Điểm số: {scorePercent}% ({correctCount} / {order.length} câu đúng)
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300">
                  <span>• Số câu đúng: {correctCount}</span>
                  <span>• Số câu sai (bao gồm bỏ trống): {order.length - correctCount}</span>
                  <span>• Số câu bỏ trống lúc nộp: {unansweredCount}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onExitSession}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-900 hover:bg-slate-100"
                >
                  Cấu hình đề thi mới
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Question + Grid Drawer */}
        <div className="flex flex-col lg:flex-row items-start gap-6">
          <div className="flex-1 min-w-0 w-full">
            {currentQuestion && (
              <QuestionCard
                question={currentQuestion}
                mode="exam"
                selectedOptionIds={selectedOptions}
                /** Strictly hidden until exam is submitted! */
                isSubmittedOrRevealed={Boolean(isCompleted)}
                isLocked={Boolean(isCompleted)}
                isBookmarked={Boolean(state.bookmarks[currentQId])}
                isFlaggedForExam={Boolean(activeExamSession.flaggedQuestions[currentQId])}
                noteText={state.notes[currentQId] || ''}
                questionIndex={currentIndex}
                totalQuestionsInView={order.length}
                onSelectOption={handleSelectOption}
                onToggleBookmark={() => onToggleBookmark(currentQId)}
                onToggleExamFlag={() => onToggleExamFlag(currentQId)}
                onSaveNote={(note) => onSaveNote(currentQId, note)}
                hasPrev={currentIndex > 0}
                hasNext={currentIndex < order.length - 1}
                onPrevQuestion={() => {
                  if (currentIndex > 0) {
                    onSetCurrentQuestion(order[currentIndex - 1]);
                  }
                }}
                onNextQuestion={() => {
                  if (currentIndex < order.length - 1) {
                    onSetCurrentQuestion(order[currentIndex + 1]);
                  }
                }}
              />
            )}
          </div>

          <QuestionGridDrawer
            items={gridItems}
            currentQuestionId={currentQId}
            onSelectQuestion={(id) => onSetCurrentQuestion(id)}
            isOpenMobile={isMobileDrawerOpen}
            onCloseMobile={() => setIsMobileDrawerOpen(false)}
            title={isCompleted ? 'Xem lại bài thi' : 'Điều hướng bài thi'}
          />
        </div>

        {/* Early Submit Confirmation Modal */}
        {showConfirmModal && !isCompleted && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-submit-title"
          >
            <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="confirm-submit-title"
                    className="text-base font-bold text-slate-900 dark:text-slate-100"
                  >
                    Xác nhận nộp bài thi thử?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Sau khi nộp bài, toàn bộ lựa chọn sẽ bị khóa và hệ thống sẽ chấm điểm tất cả{' '}
                    <strong>{order.length} câu hỏi</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span>Số câu đã chọn đáp án:</span>
                  <strong>
                    {answeredCount} / {order.length} câu
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Số câu bỏ trống (sẽ chấm là Sai):</span>
                  <strong className={unansweredCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}>
                    {unansweredCount} câu
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Số câu đang gắn cờ xem lại:</span>
                  <strong className={flaggedCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
                    {flaggedCount} câu
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Quay lại làm tiếp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false);
                    onSubmitExam(false);
                  }}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white"
                >
                  Xác nhận nộp bài ngay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Configuration View for Mock Exam
  return (
    <div className="max-w-3xl mx-auto">
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Thi thử (Mock Exam)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Cấu hình luyện tập
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Ẩn toàn bộ đáp án và lời giải cho tới khi nộp bài. Đồng hồ tính theo mốc thời gian
                tuyệt đối (deadline), tải lại trang hoặc chuyển tab không làm reset giờ.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer Box */}
        <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <span>
            <strong>Lưu ý về Cấu hình luyện tập:</strong> Thông số mặc định{' '}
            <strong>30 câu / 45 phút / ngưỡng 80%</strong> là cấu hình gợi ý để bạn tự rèn luyện tốc
            độ và áp lực thời gian, không mô tả hay đại diện cho thể lệ thi chính thức của Anthropic.
          </span>
        </div>

        <form onSubmit={handleStartExam} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Number of questions */}
            <div className="space-y-1.5">
              <label
                htmlFor="exam-count-input"
                className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Số lượng câu hỏi (1 – 110)
              </label>
              <input
                id="exam-count-input"
                type="number"
                min={1}
                max={110}
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(Math.max(1, Math.min(110, parseInt(e.target.value, 10) || 1)))
                }
                className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-bold"
              />
              <div className="flex gap-1.5 pt-1">
                {[30, 50, 60, 110].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuestionCount(preset)}
                    className={`px-2 py-1 rounded text-xs font-medium border ${
                      questionCount === preset
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {preset}c
                  </button>
                ))}
              </div>
            </div>

            {/* Duration in minutes */}
            <div className="space-y-1.5">
              <label
                htmlFor="exam-duration-input"
                className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Thời gian làm bài (Phút)
              </label>
              <input
                id="exam-duration-input"
                type="number"
                min={1}
                max={240}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Math.max(1, Math.min(240, parseInt(e.target.value, 10) || 1)))
                }
                className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-bold"
              />
              <div className="flex gap-1.5 pt-1">
                {[30, 45, 60, 90, 120].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDurationMinutes(preset)}
                    className={`px-2 py-1 rounded text-xs font-medium border ${
                      durationMinutes === preset
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {preset}p
                  </button>
                ))}
              </div>
            </div>

            {/* Target Passing Threshold */}
            <div className="space-y-1.5">
              <label
                htmlFor="exam-target-input"
                className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Ngưỡng mục tiêu (%)
              </label>
              <input
                id="exam-target-input"
                type="number"
                min={10}
                max={100}
                value={targetScorePercent}
                onChange={(e) =>
                  setTargetScorePercent(
                    Math.max(10, Math.min(100, parseInt(e.target.value, 10) || 80))
                  )
                }
                className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-bold"
              />
              <div className="flex gap-1.5 pt-1">
                {[70, 75, 80, 85, 90].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTargetScorePercent(preset)}
                    className={`px-2 py-1 rounded text-xs font-medium border ${
                      targetScorePercent === preset
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Source Question Pool */}
          <div className="space-y-1.5">
            <label
              htmlFor="exam-pool-select"
              className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              Nguồn câu hỏi lấy đề
            </label>
            <select
              id="exam-pool-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as QuestionFilterType)}
              className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="all">Toàn bộ ngân hàng ({stats.totalQuestions} câu)</option>
              <option value="unanswered">Chỉ lấy câu chưa làm ({stats.unansweredCount} câu)</option>
              <option value="wrong_latest">
                Chỉ lấy câu đang sai ({stats.wrongLatestCount} câu)
              </option>
              <option value="wrong_ever">Chỉ lấy câu từng sai ({stats.everWrongCount} câu)</option>
              <option value="bookmarked">
                Chỉ lấy câu đã đánh dấu ({stats.bookmarkedCount} câu)
              </option>
            </select>
            {availableCount > 0 && availableCount < questionCount && (
              <p className="text-xs text-amber-700 dark:text-amber-300 pt-1">
                Tập lọc hiện có sẵn <strong>{availableCount} câu</strong>. Đề thi thử sẽ sử dụng đúng{' '}
                <strong>{availableCount} câu</strong> này (không lặp câu).
              </p>
            )}
          </div>

          {/* Shuffle Toggle */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Shuffle className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
              <div>
                <label
                  htmlFor="exam-shuffle-toggle"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Đảo thứ tự câu hỏi trong đề thi
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Giữ nguyên thứ tự phương án A/B/C/D của từng câu hỏi để đảm bảo tính chính xác của lời
                  giải sau khi nộp.
                </p>
              </div>
            </div>
            <input
              id="exam-shuffle-toggle"
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={availableCount === 0}
            className="w-full py-3.5 px-6 rounded-xl text-sm sm:text-base font-bold bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              Bắt đầu Thi thử ({availableCount > 0 ? effectiveCount : 0} câu / {durationMinutes} phút /
              Mục tiêu {targetScorePercent}%)
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
