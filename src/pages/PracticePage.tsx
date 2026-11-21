import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Grid,
  Play,
  RotateCcw,
  Shuffle,
  Target,
} from 'lucide-react';
import { ALL_DERIVED_TAGS, QUESTIONS_BY_ID } from '../data/questionBank';
import {
  createSessionFromPool,
  FILTER_LABELS,
  getFilteredPool,
} from '../lib/session';
import type { AggregateStats } from '../lib/stats';
import type {
  ActiveSession,
  AppProgressState,
  QuestionFilterType,
} from '../types';
import { QuestionCard } from '../components/QuestionCard';
import { QuestionGridDrawer, QuestionGridItem } from '../components/QuestionGridDrawer';

interface PracticePageProps {
  state: AppProgressState;
  stats: AggregateStats;
  onStartSession: (session: ActiveSession) => void;
  onUpdateSessionSelection: (questionId: string, selectedOptionIds: string[]) => void;
  onCheckPracticeQuestion: (questionId: string, selectedOptionIds: string[]) => void;
  onSetCurrentQuestion: (questionId: string) => void;
  onFinishPracticeSession: () => void;
  onExitSession: () => void;
  onToggleBookmark: (questionId: string) => void;
  onSaveNote: (questionId: string, note: string) => void;
}

const PRESET_COUNTS = [10, 20, 30, 50, 110] as const;

export const PracticePage: React.FC<PracticePageProps> = ({
  state,
  stats,
  onStartSession,
  onUpdateSessionSelection,
  onCheckPracticeQuestion,
  onSetCurrentQuestion,
  onFinishPracticeSession,
  onExitSession,
  onToggleBookmark,
  onSaveNote,
}) => {
  const [filterType, setFilterType] = useState<QuestionFilterType>('all');
  const [derivedTag, setDerivedTag] = useState<string>('all');
  const [requestedCount, setRequestedCount] = useState<number>(20);
  const [customCountInput, setCustomCountInput] = useState<string>('20');
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const activePracticeSession =
    state.activeSession && state.activeSession.mode === 'practice'
      ? state.activeSession
      : null;

  const availablePool = useMemo(
    () => getFilteredPool(stats, filterType, derivedTag),
    [stats, filterType, derivedTag]
  );

  const availableCount = availablePool.length;
  const effectiveCount = Math.min(Math.max(1, requestedCount), availableCount);
  const isPoolSmallerThanRequested = availableCount > 0 && availableCount < requestedCount;

  const handleCountChange = (val: string) => {
    setCustomCountInput(val);
    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) {
      setRequestedCount(Math.max(1, Math.min(110, num)));
    }
  };

  const handleStartPractice = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createSessionFromPool(stats, {
      mode: 'practice',
      filterType,
      derivedTag,
      requestedCount,
      shuffleQuestions,
    });
    if (res.session) {
      onStartSession(res.session);
    }
  };

  // If an active practice session is running or completed, display it
  if (activePracticeSession) {
    const order = activePracticeSession.questionOrder;
    const currentQId = activePracticeSession.currentQuestionId || order[0];
    const currentQuestion = QUESTIONS_BY_ID[currentQId];
    const currentIndex = order.indexOf(currentQId);
    const checkedMap = activePracticeSession.checkedQuestions;
    const checkedCount = Object.keys(checkedMap).length;
    const correctCount = Object.values(checkedMap).filter((c) => c.isCorrect).length;
    const isSessionCompleted = activePracticeSession.status === 'completed';

    const gridItems: QuestionGridItem[] = order.map((qId, idx) => {
      const check = checkedMap[qId];
      const sel = activePracticeSession.selections[qId] || [];
      let status: QuestionGridItem['status'] = 'unanswered';
      if (check) {
        status = check.isCorrect ? 'correct' : 'wrong';
      } else if (sel.length > 0) {
        status = 'answered_pending';
      }
      return {
        id: qId,
        number: idx + 1,
        label: `${idx + 1}`,
        status,
        isBookmarked: Boolean(state.bookmarks[qId]),
      };
    });

    const selectedOptions = activePracticeSession.selections[currentQId] || [];
    const currentChecked = checkedMap[currentQId];

    const handleSelectOption = (optionId: string) => {
      if (!currentQuestion || currentChecked || isSessionCompleted) return;
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

    return (
      <div className="space-y-6">
        {/* Session Header Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                Chế độ Luyện tập
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {activePracticeSession.title}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Đã kiểm tra: <strong>{checkedCount}</strong> / {order.length} câu • Đúng:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">{correctCount}</strong> câu
              {checkedCount > 0 && (
                <span> ({Math.round((correctCount / checkedCount) * 100)}%)</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Lưới câu ({order.length})</span>
            </button>

            {!isSessionCompleted && (
              <button
                type="button"
                onClick={onFinishPracticeSession}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Hoàn thành & Tổng kết phiên</span>
              </button>
            )}

            <button
              type="button"
              onClick={onExitSession}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isSessionCompleted ? 'Tạo đề luyện tập mới' : 'Thoát phiên'}</span>
            </button>
          </div>
        </div>

        {/* Summary Banner when Completed */}
        {isSessionCompleted && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-900 to-slate-900 text-white border border-emerald-700/50 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                <Award className="w-4 h-4" />
                <span>Tổng kết phiên luyện tập</span>
              </div>
              <h3 className="text-2xl font-bold">
                Kết quả: {correctCount} / {order.length} câu đúng (
                {Math.round((correctCount / Math.max(1, order.length)) * 100)}%)
              </h3>
              <p className="text-xs sm:text-sm text-slate-300">
                Bạn có thể bấm vào từng số câu ở bảng bên phải để xem lại chi tiết đáp án và giải thích.
              </p>
            </div>
            <button
              type="button"
              onClick={onExitSession}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-900 hover:bg-slate-100 shrink-0"
            >
              Luyện tập bộ đề khác
            </button>
          </div>
        )}

        {/* Active Question + Grid Sidebar */}
        <div className="flex flex-col lg:flex-row items-start gap-6">
          <div className="flex-1 min-w-0 w-full">
            {currentQuestion && (
              <QuestionCard
                question={currentQuestion}
                mode="practice"
                selectedOptionIds={selectedOptions}
                isSubmittedOrRevealed={Boolean(currentChecked) || isSessionCompleted}
                isLocked={Boolean(currentChecked) || isSessionCompleted}
                isBookmarked={Boolean(state.bookmarks[currentQId])}
                noteText={state.notes[currentQId] || ''}
                questionIndex={currentIndex}
                totalQuestionsInView={order.length}
                onSelectOption={handleSelectOption}
                onCheckAnswer={() => onCheckPracticeQuestion(currentQId, selectedOptions)}
                onToggleBookmark={() => onToggleBookmark(currentQId)}
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
            title="Tiến độ phiên luyện tập"
          />
        </div>
      </div>
    );
  }

  // Configuration View to start a Practice Session
  return (
    <div className="max-w-3xl mx-auto">
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Cấu hình phiên Luyện tập
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Chọn tập câu hỏi nguồn, số lượng câu từ 1 đến 110 và tùy chọn đảo thứ tự câu. Hiển thị
              đúng/sai và lời giải ngay sau khi kiểm tra từng câu.
            </p>
          </div>
        </div>

        <form onSubmit={handleStartPractice} className="space-y-6">
          {/* 1. Filter Pool Selection */}
          <div className="space-y-2">
            <label
              htmlFor="practice-filter-select"
              className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              1. Chọn nhóm câu hỏi cần luyện
            </label>
            <select
              id="practice-filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as QuestionFilterType)}
              className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Toàn bộ ngân hàng ({stats.totalQuestions} câu)</option>
              <option value="unanswered">Câu chưa làm ({stats.unansweredCount} câu)</option>
              <option value="wrong_latest">
                Câu đang sai ở lượt gần nhất ({stats.wrongLatestCount} câu)
              </option>
              <option value="wrong_ever">Câu từng trả lời sai ({stats.everWrongCount} câu)</option>
              <option value="bookmarked">Câu đã đánh dấu ({stats.bookmarkedCount} câu)</option>
              <option value="due">Câu đến hạn ôn tập ({stats.dueForReviewCount} câu)</option>
              <option value="multiple_choice">
                Nhóm câu chọn nhiều đáp án (8 câu multiple_choice)
              </option>
            </select>
          </div>

          {/* 2. Optional Derived Tag Filter */}
          <div className="space-y-2">
            <label
              htmlFor="practice-tag-select"
              className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              2. Lọc theo Nhãn hỗ trợ học tập (Tùy chọn)
            </label>
            <select
              id="practice-tag-select"
              value={derivedTag}
              onChange={(e) => setDerivedTag(e.target.value)}
              className="w-full py-2.5 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Tất cả các mảng chủ đề</option>
              {ALL_DERIVED_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Question Count Selection */}
          <div className="space-y-2.5">
            <label
              htmlFor="practice-count-input"
              className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              3. Số lượng câu hỏi (1 – 110)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COUNTS.map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    setRequestedCount(cnt);
                    setCustomCountInput(String(cnt));
                  }}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                    requestedCount === cnt
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cnt === 110 ? 'Toàn bộ (110)' : `${cnt} câu`}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-slate-500">Tự nhập:</span>
                <input
                  id="practice-count-input"
                  type="number"
                  min={1}
                  max={110}
                  value={customCountInput}
                  onChange={(e) => handleCountChange(e.target.value)}
                  className="w-20 py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-center"
                />
              </div>
            </div>

            {/* Pool Availability Notice (Never duplicates questions!) */}
            {availableCount === 0 ? (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm text-rose-800 dark:text-rose-200 flex items-center gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Tập lọc hiện tại đang có <strong>0 câu hỏi</strong>. Vui lòng chọn nhóm câu hỏi khác
                  để bắt đầu.
                </span>
              </div>
            ) : isPoolSmallerThanRequested ? (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Tập lọc hiện chỉ có sẵn <strong>{availableCount} câu</strong> (ít hơn mức{' '}
                  {requestedCount} câu bạn chọn). Hệ thống sẽ tạo đề với đúng{' '}
                  <strong>{availableCount} câu duy nhất có sẵn</strong>, không lặp lại câu hỏi để bù.
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Số câu khả dụng trong tập lọc: <strong>{availableCount} câu</strong> → Sẽ lấy{' '}
                <strong>{effectiveCount} câu</strong>.
              </p>
            )}
          </div>

          {/* 4. Shuffle Toggle */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Shuffle className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
              <div>
                <label
                  htmlFor="practice-shuffle-toggle"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Đảo ngẫu nhiên thứ tự câu hỏi
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Chỉ đảo vị trí xuất hiện của các câu hỏi. Thứ tự phương án A/B/C/D trong từng câu được
                  giữ nguyên theo nguồn để lời giải tham chiếu chính xác.
                </p>
              </div>
            </div>
            <input
              id="practice-shuffle-toggle"
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              className="w-5 h-5 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={availableCount === 0}
              className="w-full py-3.5 px-6 rounded-xl text-sm sm:text-base font-bold bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                Bắt đầu phiên luyện tập ({availableCount > 0 ? effectiveCount : 0} câu)
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
