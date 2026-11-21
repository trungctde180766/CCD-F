import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  History,
  Info,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { extractBlockText, QUESTIONS, QUESTIONS_BY_ID } from '../data/questionBank';
import { getHoChiMinhDateString, SRS_INTERVAL_STEPS, SRS_TIMEZONE } from '../lib/srs';
import type { AggregateStats } from '../lib/stats';
import type { AppProgressState, QuestionFilterType } from '../types';

interface ReviewPageProps {
  state: AppProgressState;
  stats: AggregateStats;
  onOpenQuestionInStudy: (questionId: string, filter?: QuestionFilterType) => void;
  onStartQuickPractice: (filter: QuestionFilterType) => void;
}

type ReviewTab = 'due' | 'wrong_latest' | 'wrong_ever' | 'history';

export const ReviewPage: React.FC<ReviewPageProps> = ({
  state,
  stats,
  onOpenQuestionInStudy,
  onStartQuickPractice,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ReviewTab>('due');
  const todayHCM = getHoChiMinhDateString();

  const dueQuestions = useMemo(
    () => QUESTIONS.filter((q) => stats.perQuestion[q.id]?.isDueForReview),
    [stats]
  );

  const wrongLatestQuestions = useMemo(
    () => QUESTIONS.filter((q) => stats.perQuestion[q.id]?.isCurrentlyWrong),
    [stats]
  );

  const everWrongQuestions = useMemo(
    () => QUESTIONS.filter((q) => stats.perQuestion[q.id]?.wasEverWrong),
    [stats]
  );

  const reversedAttempts = useMemo(
    () => [...state.attempts].reverse(),
    [state.attempts]
  );

  const activeList =
    activeSubTab === 'due'
      ? dueQuestions
      : activeSubTab === 'wrong_latest'
      ? wrongLatestQuestions
      : everWrongQuestions;

  return (
    <div className="space-y-6">
      {/* SRS Rule Transparency Banner */}
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              <CalendarClock className="w-4 h-4" />
              <span>Lịch ôn tập ngắt quãng & Phân tích câu sai</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              Quy tắc nhắc ôn (Múi giờ {SRS_TIMEZONE} • Hôm nay: {todayHCM})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dueQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => onStartQuickPractice('due')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Luyện ngay {dueQuestions.length} câu đến hạn</span>
              </button>
            )}
            {wrongLatestQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => onStartQuickPractice('wrong_latest')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ôn {wrongLatestQuestions.length} câu đang sai</span>
              </button>
            )}
          </div>
        </div>

        {/* Explicit SRS Rules Box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm">
          <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
            <div className="font-bold text-rose-900 dark:text-rose-200 mb-1">
              1. Khi trả lời Sai
            </div>
            <p className="text-rose-800 dark:text-rose-300 text-xs leading-relaxed">
              Câu hỏi sẽ được đặt hạn ôn lại vào <strong>ngày hôm sau (+1 ngày)</strong> theo lịch{' '}
              <code>Asia/Ho_Chi_Minh</code> và <strong>reset chuỗi (streak = 0)</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
            <div className="font-bold text-emerald-900 dark:text-emerald-200 mb-1">
              2. Khi trả lời Đúng không trợ giúp
            </div>
            <p className="text-emerald-800 dark:text-emerald-300 text-xs leading-relaxed">
              Tăng chuỗi đúng liên tiếp và dời ngày ôn tiếp theo qua các mốc:{' '}
              <strong>{SRS_INTERVAL_STEPS.join(' → ')} ngày</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
            <div className="font-bold text-amber-900 dark:text-amber-200 mb-1">
              3. Khi bấm “Xem đáp án trước”
            </div>
            <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
              Ghi nhận là lượt có trợ giúp (<code>revealedBeforeCheck = true</code>):{' '}
              <strong>không tăng chuỗi nhớ</strong> và nhắc ôn lại vào ngày hôm sau.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
          <Info className="w-4 h-4 shrink-0 text-slate-400" />
          <span>
            <strong>Lưu ý:</strong> Đây là lịch học hỗ trợ ghi nhớ ngắt quãng cho cá nhân, không phải
            công cụ dự đoán xác suất đỗ kỳ thi.
          </span>
        </div>
      </section>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('due')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
            activeSubTab === 'due'
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
          }`}
        >
          Đến hạn ôn hôm nay ({dueQuestions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('wrong_latest')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
            activeSubTab === 'wrong_latest'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
          }`}
        >
          Đang sai ở lượt gần nhất ({wrongLatestQuestions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('wrong_ever')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
            activeSubTab === 'wrong_ever'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
          }`}
        >
          Từng sai trong lịch sử ({everWrongQuestions.length} • Đã khắc phục:{' '}
          {stats.recoveredFromWrongCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors inline-flex items-center gap-1.5 ${
            activeSubTab === 'history'
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Nhật ký từng lượt trả lời ({state.attempts.length})</span>
        </button>
      </div>

      {/* Sub-tab Content */}
      {activeSubTab !== 'history' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {activeList.length === 0 ? (
            <div className="p-12 text-center space-y-2 text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 stroke-1.5" />
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                {activeSubTab === 'due'
                  ? 'Tuyệt vời! Hiện không có câu hỏi nào đến hạn ôn tập hôm nay.'
                  : activeSubTab === 'wrong_latest'
                  ? 'Không có câu hỏi nào đang sai ở lượt làm gần nhất.'
                  : 'Chưa có câu hỏi nào từng trả lời sai.'}
              </p>
              <p className="text-xs">
                Khi bạn làm bài trong phần Học từng câu, Luyện tập hoặc Thi thử, lịch ôn và danh sách
                câu sai sẽ tự động cập nhật tại đây.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {activeList.map((q) => {
                const meta = stats.perQuestion[q.id];
                const srs = meta?.srs;
                const promptPreview = extractBlockText(q.prompt);

                return (
                  <div
                    key={q.id}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {q.id}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {q.title}
                        </span>

                        {meta?.isCurrentlyWrong ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                            <XCircle className="w-3 h-3" />
                            Đang sai (lượt gần nhất)
                          </span>
                        ) : meta?.isRecoveredFromWrong ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Từng sai → Đã sửa đúng ở lượt gần nhất
                          </span>
                        ) : null}

                        {srs && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            Chuỗi: {srs.streak} • Hạn ôn: {srs.dueDate} ({srs.intervalDays}d)
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 break-words">
                        {promptPreview}
                      </p>

                      {meta?.latestAttempt && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Lượt gần nhất ({new Date(meta.latestAttempt.answeredAt).toLocaleString('vi-VN')}
                          ): Đã chọn{' '}
                          <strong className="font-mono">
                            {meta.latestAttempt.selectedOptionIds.length > 0
                              ? meta.latestAttempt.selectedOptionIds
                                  .map((x) => x.toUpperCase())
                                  .join(', ')
                              : '(Bỏ trống)'}
                          </strong>{' '}
                          • Tổng số lượt làm: <strong>{meta.attemptsCount}</strong>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenQuestionInStudy(
                            q.id,
                            activeSubTab === 'due'
                              ? 'due'
                              : activeSubTab === 'wrong_latest'
                              ? 'wrong_latest'
                              : 'wrong_ever'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
                      >
                        <span>Ôn câu này</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Detailed Attempt Log Table */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {reversedAttempts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-sm font-medium">Chưa có lượt trả lời nào trong lịch sử.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Mã câu</th>
                    <th className="py-3 px-4">Chế độ</th>
                    <th className="py-3 px-4">Lựa chọn</th>
                    <th className="py-3 px-4">Đáp án nguồn</th>
                    <th className="py-3 px-4">Kết quả</th>
                    <th className="py-3 px-4">Mã phiên</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {reversedAttempts.slice(0, 200).map((att) => (
                    <tr
                      key={att.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(att.answeredAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold">
                        <button
                          type="button"
                          onClick={() => onOpenQuestionInStudy(att.questionId)}
                          className="text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          {att.questionId}
                        </button>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800">
                          {att.mode === 'exam'
                            ? 'Thi thử'
                            : att.mode === 'practice'
                            ? 'Luyện tập'
                            : 'Học từng câu'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold">
                        {att.selectedOptionIds.length > 0
                          ? att.selectedOptionIds.map((x) => x.toUpperCase()).join(', ')
                          : '(Trống)'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {att.correctOptionIds.map((x) => x.toUpperCase()).join(', ')}
                      </td>
                      <td className="py-2.5 px-4">
                        {att.revealedBeforeCheck ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Đã xem giải trước</span>
                          </span>
                        ) : att.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đúng tự lực</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Sai</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
                        {att.sessionId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
