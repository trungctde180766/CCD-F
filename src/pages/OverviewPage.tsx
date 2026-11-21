import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  Bookmark,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Eye,
  History,
  Layers,
  Play,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { DATASET_VALIDATION, QUESTION_BANK, QUESTIONS_BY_ID } from '../data/questionBank';
import type { AggregateStats } from '../lib/stats';
import type {
  ActiveSession,
  AppProgressState,
  NavigationTab,
  QuestionFilterType,
} from '../types';

interface OverviewPageProps {
  state: AppProgressState;
  stats: AggregateStats;
  onNavigateTab: (tab: NavigationTab) => void;
  onOpenStudyWithFilter: (filter: QuestionFilterType, questionId?: string, tag?: string) => void;
  onResumeActiveSession: () => void;
  onDiscardActiveSession: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  state,
  stats,
  onNavigateTab,
  onOpenStudyWithFilter,
  onResumeActiveSession,
  onDiscardActiveSession,
}) => {
  const activeSession: ActiveSession | null =
    state.activeSession && state.activeSession.status === 'in_progress'
      ? state.activeSession
      : null;

  const lastStudiedQuestion = state.lastStudiedQuestionId
    ? QUESTIONS_BY_ID[state.lastStudiedQuestionId]
    : null;

  const progressBarAnsweredPct = Math.round((stats.answeredCount / stats.totalQuestions) * 100);
  const progressBarCorrectPct = Math.round(
    (stats.correctUnassistedLatestCount / stats.totalQuestions) * 100
  );
  const progressBarViewedOnlyPct = Math.round((stats.viewedOnlyCount / stats.totalQuestions) * 100);

  return (
    <div className="space-y-8">
      {/* Hero & Continue Learning Banner */}
      <section className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 text-white shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                Ngân hàng {DATASET_VALIDATION.totalQuestions} câu hỏi thực tế ({DATASET_VALIDATION.singleChoiceCount}{' '}
                single_choice • {DATASET_VALIDATION.multipleChoiceCount} multiple_choice)
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Bảng điều khiển tự học CCDV-F
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Hệ thống phân biệt rõ <strong>Đã xem</strong> (mới mở đọc câu hỏi),{' '}
              <strong>Đã trả lời</strong> (đã nộp đáp án kiểm tra) và{' '}
              <strong>Đã trả lời đúng tự lực</strong> (không xem đáp án trước). Không coi việc chỉ mở
              xem câu hỏi là đã nắm kiến thức.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {activeSession ? (
              <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 space-y-3 w-full sm:w-auto">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-amber-300">
                    Phiên đang làm dở
                  </span>
                  <div className="font-bold text-sm mt-0.5">{activeSession.title}</div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Đang ở câu: <code className="font-mono">{activeSession.currentQuestionId}</code> •
                    Đã chọn {Object.keys(activeSession.selections).length}/
                    {activeSession.questionOrder.length} câu
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onResumeActiveSession}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-brand-500 hover:bg-brand-400 text-white shadow-xs transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Tiếp tục học phiên này</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDiscardActiveSession}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
                  >
                    Hủy phiên
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    onOpenStudyWithFilter(
                      'all',
                      lastStudiedQuestion ? lastStudiedQuestion.id : 'ccdv-f-q001'
                    )
                  }
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {lastStudiedQuestion
                      ? `Tiếp tục học (${lastStudiedQuestion.id})`
                      : 'Bắt đầu học từ Câu 1'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('exam')}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors"
                >
                  <Timer className="w-4 h-4" />
                  <span>Thi thử 30 câu / 45p</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Multi-segment visual progress bar */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 mb-2">
            <span>
              Tiến độ tổng thể trên <strong>{stats.totalQuestions} mã câu duy nhất</strong>
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                Đúng tự lực: <strong>{stats.correctUnassistedLatestCount}</strong> (
                {progressBarCorrectPct}%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                Đang sai / Xem giải: <strong>{stats.wrongLatestCount}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                Đã xem (chưa làm): <strong>{stats.viewedOnlyCount}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />
                Chưa làm: <strong>{stats.unansweredCount}</strong>
              </span>
            </div>
          </div>

          <div
            className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex"
            role="progressbar"
            aria-valuenow={progressBarAnsweredPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ trả lời câu hỏi"
          >
            <div
              style={{ width: `${(stats.correctUnassistedLatestCount / stats.totalQuestions) * 100}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Đã trả lời đúng tự lực: ${stats.correctUnassistedLatestCount} câu`}
            />
            <div
              style={{ width: `${(stats.wrongLatestCount / stats.totalQuestions) * 100}%` }}
              className="bg-rose-500 transition-all duration-300"
              title={`Đang sai hoặc đã xem đáp án: ${stats.wrongLatestCount} câu`}
            />
            <div
              style={{ width: `${progressBarViewedOnlyPct}%` }}
              className="bg-blue-400/70 transition-all duration-300"
              title={`Đã mở xem nhưng chưa làm: ${stats.viewedOnlyCount} câu`}
            />
          </div>
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section aria-label="Thống kê tổng hợp" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Total Answered / Unanswered / Viewed */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Độ phủ ngân hàng câu hỏi</span>
              <Layers className="w-4 h-4 text-brand-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.answeredCount} / {stats.totalQuestions}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                câu đã trả lời
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>• Chưa trả lời:</span>
                <strong className="text-slate-900 dark:text-slate-100">
                  {stats.unansweredCount} câu
                </strong>
              </div>
              <div className="flex justify-between">
                <span>• Đã mở xem (nhưng chưa trả lời):</span>
                <strong className="text-blue-600 dark:text-blue-400">
                  {stats.viewedOnlyCount} câu
                </strong>
              </div>
              <div className="flex justify-between">
                <span>• Tổng số lượt chấm đã ghi nhận:</span>
                <strong>{stats.totalAttemptsCount} lượt</strong>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onOpenStudyWithFilter('unanswered')}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Học các câu chưa làm ({stats.unansweredCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: First-Attempt Accuracy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Độ chính xác lần đầu (First Attempt)</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.firstAttemptAccuracyPercent !== null
                  ? `${stats.firstAttemptAccuracyPercent}%`
                  : 'Chưa có dữ liệu'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Công thức: <strong>{stats.firstAttemptCorrectCount}</strong> câu đúng tự lực ở lượt làm
              đầu tiên / <strong>{stats.answeredCount}</strong> câu duy nhất đã trả lời. Phản ánh năng
              lực nền trước khi đọc lời giải.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Mẫu số: số mã câu duy nhất đã làm ({stats.answeredCount} câu)
          </div>
        </div>

        {/* Card 3: Latest-Attempt Accuracy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Độ chính xác lượt gần nhất</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.latestAttemptAccuracyPercent !== null
                  ? `${stats.latestAttemptAccuracyPercent}%`
                  : 'Chưa có dữ liệu'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Công thức: <strong>{stats.correctUnassistedLatestCount}</strong> câu đúng tự lực ở lượt
              gần nhất / <strong>{stats.answeredCount}</strong> câu duy nhất đã trả lời. (Đã khắc phục{' '}
              <strong>{stats.recoveredFromWrongCount}</strong> câu từng sai).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onOpenStudyWithFilter('wrong_latest')}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Ôn {stats.wrongLatestCount} câu đang sai ở lượt gần nhất</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 4: Due for Review (SRS) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Câu đến hạn ôn hôm nay</span>
              <CalendarClock className="w-4 h-4 text-brand-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {stats.dueForReviewCount}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                câu đến hạn (Asia/Ho_Chi_Minh)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Chu kỳ nhắc ôn ngắt quãng: 1 → 3 → 7 → 14 → 30 ngày cho câu trả lời đúng tự lực. Câu sai
              sẽ về hạn ôn vào ngày hôm sau.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onNavigateTab('review')}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Mở bảng lịch ôn & câu sai</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 5: Bookmarks & Notes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Câu đánh dấu & Ghi chú</span>
              <Bookmark className="w-4 h-4 text-brand-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-4">
              <div>
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.bookmarkedCount}
                </span>
                <span className="ml-1.5 text-xs text-slate-500">đánh dấu</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                  {stats.notesCount}
                </span>
                <span className="ml-1.5 text-xs text-slate-500">ghi chú</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Đánh dấu và ghi chú được gắn theo mã câu hỏi (<code className="font-mono">ccdv-f-q001</code>
              ..
              <code className="font-mono">q110</code>) để lọc luyện tập nhanh.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onOpenStudyWithFilter('bookmarked')}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Xem các câu đã đánh dấu ({stats.bookmarkedCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 6: Multiple-choice highlight */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Nhóm 8 câu chọn nhiều đáp án</span>
              <Target className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">8 câu</span>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                multiple_choice
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Gồm các mã: <code className="font-mono">q078, q081, q087, q092, q100, q103, q104, q106</code>.
              Chấm theo tập hợp ID lựa chọn (chọn đủ, không chọn thừa).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onOpenStudyWithFilter('multiple_choice')}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Luyện riêng 8 câu chọn nhiều đáp án</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Two-Column Breakdown: Derived Study Tags & Session History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Progress by Derived Learning Tag */}
        <section className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Phân bố theo Nhãn hỗ trợ học tập (Derived Study Tags)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Topic gốc được giữ nguyên là{' '}
                <code className="font-mono">{QUESTION_BANK.topics[0]?.id}</code>. Các nhãn dưới đây
                được gán tự động theo từ khóa kỹ thuật để hỗ trợ ôn tập theo mảng.
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {stats.byDerivedTag.map((item) => {
              const answeredRatio = Math.round((item.answered / item.total) * 100);
              const correctRatio = Math.round((item.correctLatest / item.total) * 100);
              return (
                <div
                  key={item.tag}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenStudyWithFilter('all', undefined, item.tag)}
                      className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 text-left"
                    >
                      {item.tag}
                    </button>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        Đã làm: <strong>{item.answered}</strong>/{item.total} câu
                      </span>
                      <span>
                        Đúng gần nhất:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {item.accuracyPercent !== null ? `${item.accuracyPercent}%` : '—'}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                    <div
                      style={{ width: `${correctRatio}%` }}
                      className="bg-emerald-500"
                      title={`Đúng: ${item.correctLatest} câu`}
                    />
                    <div
                      style={{ width: `${Math.max(0, answeredRatio - correctRatio)}%` }}
                      className="bg-rose-400"
                      title={`Đang sai: ${item.answered - item.correctLatest} câu`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Session History */}
        <section className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-500" />
                  <span>Lịch sử phiên luyện tập & thi thử</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lưu đầy đủ điểm số, thời gian làm bài và trạng thái đạt ngưỡng mục tiêu.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {state.sessionHistory.length} phiên
              </span>
            </div>

            {state.sessionHistory.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-slate-400 stroke-1" />
                <p className="text-sm font-medium">Chưa có phiên luyện tập hoặc thi thử nào hoàn tất</p>
                <p className="text-xs">
                  Bạn có thể bắt đầu một đề Luyện tập nhanh 10 câu hoặc Thi thử 30 câu để theo dõi lịch sử
                  tại đây.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {state.sessionHistory.slice(0, 15).map((sess) => {
                  const isExam = sess.mode === 'exam';
                  return (
                    <div
                      key={sess.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isExam
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                            }`}
                          >
                            {isExam ? 'Thi thử' : 'Luyện tập'}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {sess.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                          <span>{new Date(sess.submittedAt).toLocaleString('vi-VN')}</span>
                          <span>•</span>
                          <span>
                            Đúng {sess.correctCount}/{sess.totalQuestions} câu
                          </span>
                          {sess.autoSubmittedByTimeout && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              (Hết giờ tự nộp)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-base font-bold ${
                            sess.passed === false
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {sess.scorePercent}%
                        </div>
                        {sess.targetScorePercent !== null && (
                          <div className="text-[10px] font-medium text-slate-500">
                            Mục tiêu {sess.targetScorePercent}%:{' '}
                            <strong
                              className={
                                sess.passed
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {sess.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => onNavigateTab('practice')}
              className="font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              + Tạo đề luyện tập mới
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('library')}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Sao lưu tiến độ (JSON) →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
