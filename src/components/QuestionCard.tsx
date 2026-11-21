import React, { useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Eye,
  Flag,
  HelpCircle,
  Info,
  MessageSquarePlus,
  RotateCcw,
  Sparkles,
  Tag,
  XCircle,
} from 'lucide-react';
import type { Question, StudyMode } from '../types';
import { gradeQuestion } from '../lib/scoring';
import { BlockRenderer } from './BlockRenderer';

export interface QuestionCardProps {
  question: Question;
  mode: StudyMode;
  selectedOptionIds: string[];
  /** Whether the answer & explanation are revealed/graded for this view */
  isSubmittedOrRevealed: boolean;
  /** Whether user clicked "Xem đáp án trước" prior to checking */
  revealedBeforeCheck?: boolean;
  /** Whether selection inputs are locked */
  isLocked: boolean;
  isBookmarked: boolean;
  isFlaggedForExam?: boolean;
  noteText: string;
  questionIndex?: number;
  totalQuestionsInView?: number;
  onSelectOption: (optionId: string) => void;
  onCheckAnswer?: () => void;
  onRevealAnswerBeforeCheck?: () => void;
  onRetryQuestion?: () => void;
  onToggleBookmark: () => void;
  onToggleExamFlag?: () => void;
  onSaveNote: (note: string) => void;
  onPrevQuestion?: () => void;
  onNextQuestion?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

/**
 * Core Question Card component.
 * STRICT ANTI-SPOILER GUARANTEE:
 * When `isSubmittedOrRevealed === false`:
 * - Correct answers (`correctOptionIds`), general `explanation`, and `optionExplanations`
 *   are NEVER rendered or referenced in the DOM, attributes, classNames, or ARIA labels.
 */
export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  mode,
  selectedOptionIds,
  isSubmittedOrRevealed,
  revealedBeforeCheck = false,
  isLocked,
  isBookmarked,
  isFlaggedForExam = false,
  noteText,
  questionIndex,
  totalQuestionsInView,
  onSelectOption,
  onCheckAnswer,
  onRevealAnswerBeforeCheck,
  onRetryQuestion,
  onToggleBookmark,
  onToggleExamFlag,
  onSaveNote,
  onPrevQuestion,
  onNextQuestion,
  hasPrev = false,
  hasNext = false,
}) => {
  const [isNoteOpen, setIsNoteOpen] = useState<boolean>(Boolean(noteText.trim()));
  const [draftNote, setDraftNote] = useState<string>(noteText);
  const [noteSavedToast, setNoteSavedToast] = useState<boolean>(false);

  // Sync draftNote when question changes
  React.useEffect(() => {
    setDraftNote(noteText);
    setIsNoteOpen(Boolean(noteText.trim()));
    setNoteSavedToast(false);
  }, [question.id, noteText]);

  const isMultiple = question.interaction.type === 'multiple_choice';

  // Only compute grading details when isSubmittedOrRevealed is true!
  const gradeResult = isSubmittedOrRevealed
    ? gradeQuestion(question, selectedOptionIds)
    : null;

  const optionExplanationMap = React.useMemo(() => {
    if (!isSubmittedOrRevealed) return new Map<string, Question['optionExplanations'][number]>();
    return new Map(
      (question.optionExplanations || []).map((oe) => [oe.optionId, oe])
    );
  }, [isSubmittedOrRevealed, question.optionExplanations]);

  const handleNoteSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveNote(draftNote);
    setNoteSavedToast(true);
    setTimeout(() => setNoteSavedToast(false), 2000);
  };

  const difficultyLabel =
    !question.difficulty || question.difficulty === 'unspecified'
      ? 'Chưa phân loại'
      : question.difficulty;

  return (
    <article
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      aria-labelledby={`question-heading-${question.id}`}
    >
      {/* Top Meta Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
            {question.id}
          </span>
          {questionIndex !== undefined && totalQuestionsInView !== undefined && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Câu {questionIndex + 1} / {totalQuestionsInView}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
              isMultiple
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}
          >
            {isMultiple ? 'Chọn nhiều đáp án' : 'Chọn một đáp án'}
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
            title="Độ khó từ dữ liệu gốc"
          >
            Độ khó: {difficultyLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {mode === 'exam' && onToggleExamFlag && (
            <button
              type="button"
              onClick={onToggleExamFlag}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isFlaggedForExam
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              aria-pressed={isFlaggedForExam}
            >
              <Flag className={`w-3.5 h-3.5 ${isFlaggedForExam ? 'fill-current' : ''}`} />
              <span>{isFlaggedForExam ? 'Đã gắn cờ xem lại' : 'Đánh dấu xem lại'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleBookmark}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              isBookmarked
                ? 'bg-brand-100 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-300 dark:border-brand-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            aria-pressed={isBookmarked}
            title="Đánh dấu câu hỏi để ôn tập (không tạo lượt chấm)"
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            <span>{isBookmarked ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNoteOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              noteText.trim()
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            aria-expanded={isNoteOpen}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>{noteText.trim() ? 'Ghi chú (1)' : 'Ghi chú'}</span>
          </button>
        </div>
      </div>

      {/* Topic & Derived Learning Tags */}
      <div className="px-4 sm:px-6 pt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Topic gốc: <code className="font-mono">{question.topicId}</code>
        </span>
        {question.derivedTags && question.derivedTags.length > 0 && (
          <>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Tag className="w-3 h-3" />
              Nhãn hỗ trợ học tập:
            </span>
            {question.derivedTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                {tag}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Question Prompt */}
      <div className="p-4 sm:p-6">
        <h2
          id={`question-heading-${question.id}`}
          className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-3"
        >
          {question.title}{' '}
          <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
            ({question.id})
          </span>
        </h2>

        <div className="mb-6">
          <BlockRenderer blocks={question.prompt} />
        </div>

        {isMultiple && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center gap-2.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Câu hỏi chọn nhiều đáp án (Multiple Choice):</strong> Hãy tích chọn tất cả các
              phương án đúng. Câu chỉ được tính là đúng khi chọn đủ và không chọn thừa phương án nào.
            </span>
          </div>
        )}

        {/* Options List */}
        <fieldset className="space-y-3" aria-label={`Các lựa chọn cho ${question.id}`}>
          <legend className="sr-only">
            {isMultiple ? 'Chọn nhiều đáp án đúng' : 'Chọn một đáp án đúng'}
          </legend>

          {question.interaction.options.map((option) => {
            const isSelected = selectedOptionIds.includes(option.id);
            const inputId = `opt-${question.id}-${option.id}`;

            // Anti-spoiler styling: only compute correct/wrong styles after submission/reveal
            let containerStyle =
              'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700';
            let badgeText: string | null = null;
            let badgeStyle = '';

            if (!isSubmittedOrRevealed) {
              if (isSelected) {
                containerStyle =
                  'border-brand-500 dark:border-brand-500 bg-brand-50/60 dark:bg-brand-950/30 ring-1 ring-brand-500';
              }
            } else if (gradeResult) {
              const isCorrectOption = gradeResult.correctOptionIds.includes(option.id);
              if (isCorrectOption && isSelected) {
                containerStyle =
                  'border-emerald-500 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500';
                badgeText = 'Đáp án đúng • Bạn đã chọn';
                badgeStyle =
                  'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200';
              } else if (isCorrectOption && !isSelected) {
                containerStyle =
                  'border-emerald-500/80 dark:border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 border-dashed';
                badgeText = 'Đáp án đúng (Bạn chưa chọn)';
                badgeStyle =
                  'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200';
              } else if (!isCorrectOption && isSelected) {
                containerStyle =
                  'border-rose-500 dark:border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 ring-1 ring-rose-500';
                badgeText = 'Lựa chọn sai';
                badgeStyle = 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200';
              } else {
                containerStyle =
                  'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-85';
              }
            }

            const perOptionExp = isSubmittedOrRevealed
              ? optionExplanationMap.get(option.id)
              : undefined;

            return (
              <div
                key={option.id}
                className={`rounded-xl border transition-all ${containerStyle}`}
              >
                <label
                  htmlFor={inputId}
                  className={`flex items-start gap-3.5 p-3.5 sm:p-4 ${
                    isLocked ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <div className="pt-0.5 flex items-center">
                    <input
                      id={inputId}
                      type={isMultiple ? 'checkbox' : 'radio'}
                      name={`question-${question.id}`}
                      value={option.id}
                      checked={isSelected}
                      disabled={isLocked}
                      onChange={() => {
                        if (!isLocked) {
                          onSelectOption(option.id);
                        }
                      }}
                      className="w-4 h-4 text-brand-600 border-slate-300 dark:border-slate-600 focus:ring-brand-500"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                        <span>Phương án {option.id.toUpperCase()}</span>
                      </span>

                      {isSubmittedOrRevealed && badgeText && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeStyle}`}
                        >
                          {gradeResult?.correctOptionIds.includes(option.id) ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{badgeText}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[15px] sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed break-words">
                      {option.label}
                    </div>
                  </div>
                </label>

                {/* Per-option explanation if revealed and provided by source */}
                {isSubmittedOrRevealed && perOptionExp && (
                  <div className="mx-3.5 sm:mx-4 mb-3.5 p-3 rounded-lg bg-white/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm">
                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Giải thích riêng cho phương án {option.id.toUpperCase()}:
                    </div>
                    <BlockRenderer blocks={perOptionExp.content} />
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>

        {/* Action Buttons Bar (Check / Reveal / Retry / Prev / Next) */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {mode !== 'exam' && !isSubmittedOrRevealed && onCheckAnswer && (
              <button
                type="button"
                onClick={onCheckAnswer}
                disabled={selectedOptionIds.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Kiểm tra đáp án</span>
              </button>
            )}

            {mode === 'study' && !isSubmittedOrRevealed && onRevealAnswerBeforeCheck && (
              <button
                type="button"
                onClick={onRevealAnswerBeforeCheck}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                title="Xem lời giải ngay (sẽ được ghi nhận là đã xem đáp án trước, không tính là trả lời đúng tự lực)"
              >
                <Eye className="w-4 h-4" />
                <span>Xem đáp án trước</span>
              </button>
            )}

            {mode !== 'exam' && isSubmittedOrRevealed && onRetryQuestion && (
              <button
                type="button"
                onClick={onRetryQuestion}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Làm lại thành lượt mới</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onPrevQuestion && (
              <button
                type="button"
                onClick={onPrevQuestion}
                disabled={!hasPrev}
                className="px-3.5 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                ← Câu trước
              </button>
            )}
            {onNextQuestion && (
              <button
                type="button"
                onClick={onNextQuestion}
                disabled={!hasNext}
                className="px-3.5 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                Câu tiếp →
              </button>
            )}
          </div>
        </div>

        {/* Personal Note Drawer */}
        {isNoteOpen && (
          <form
            onSubmit={handleNoteSave}
            className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor={`note-input-${question.id}`}
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Ghi chú cá nhân cho {question.id} (Lưu cục bộ, không tạo lượt chấm)
              </label>
              {noteSavedToast && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Đã lưu ghi chú
                </span>
              )}
            </div>
            <textarea
              id={`note-input-${question.id}`}
              rows={3}
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Ghi lại từ khóa, lưu ý bẫy đề hoặc kinh nghiệm của bạn cho câu hỏi này..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="mt-2 flex justify-end gap-2">
              {draftNote.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftNote('');
                    onSaveNote('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  Xóa ghi chú
                </button>
              )}
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white"
              >
                Lưu ghi chú
              </button>
            </div>
          </form>
        )}

        {/* Graded Result & Full Explanation Panel — ONLY mounted in DOM when isSubmittedOrRevealed is true */}
        {isSubmittedOrRevealed && gradeResult && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5"
          >
            {/* Status Banner */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                revealedBeforeCheck
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                  : gradeResult.isCorrect
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                  : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {revealedBeforeCheck ? (
                  <Eye className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : gradeResult.isCorrect ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-base">
                    {revealedBeforeCheck
                      ? 'Đã xem lời giải trước khi kiểm tra (Không tính là trả lời đúng tự lực)'
                      : gradeResult.isCorrect
                      ? 'Chính xác! Bạn đã chọn đúng toàn bộ đáp án.'
                      : gradeResult.isUnanswered
                      ? 'Chưa trả lời (Tính là Sai)'
                      : 'Chưa chính xác'}
                  </div>
                  <div className="text-xs sm:text-sm mt-1 space-y-0.5">
                    <div>
                      Lựa chọn của bạn:{' '}
                      <strong className="font-mono">
                        {gradeResult.selectedOptionIds.length > 0
                          ? gradeResult.selectedOptionIds.map((x) => x.toUpperCase()).join(', ')
                          : '(Bỏ trống)'}
                      </strong>
                    </div>
                    <div>
                      Đáp án đúng theo nguồn:{' '}
                      <strong className="font-mono">
                        {gradeResult.correctOptionIds.map((x) => x.toUpperCase()).join(', ')}
                      </strong>
                    </div>
                    {isMultiple && !gradeResult.isCorrect && !gradeResult.isUnanswered && (
                      <div className="text-xs pt-1">
                        {gradeResult.missingOptionIds.length > 0 && (
                          <span className="mr-3">
                            Thiếu phương án đúng:{' '}
                            <strong className="font-mono">
                              {gradeResult.missingOptionIds.map((x) => x.toUpperCase()).join(', ')}
                            </strong>
                          </span>
                        )}
                        {gradeResult.extraOptionIds.length > 0 && (
                          <span>
                            Chọn thừa phương án sai:{' '}
                            <strong className="font-mono">
                              {gradeResult.extraOptionIds.map((x) => x.toUpperCase()).join(', ')}
                            </strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Source Notes / Warnings if any */}
            {question.sourceNotes && question.sourceNotes.length > 0 && (
              <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs sm:text-sm text-blue-900 dark:text-blue-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Ghi chú từ dữ liệu nguồn (T-Study):</span>
                </div>
                {question.sourceNotes.map((note, idx) => (
                  <p key={idx}>{note}</p>
                ))}
              </div>
            )}

            {/* Main Explanation from Source */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-500" />
                  <span>Giải thích chi tiết từ nguồn (Explanation)</span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Nguồn: {question.source?.name || 'T-Study'} • Chưa thẩm định độc lập
                </span>
              </div>
              <BlockRenderer blocks={question.explanation} />
            </div>

            {/* Per-option explanations summary if source provided them */}
            {question.optionExplanations && question.optionExplanations.length > 0 && (
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-500" />
                  <span>Phân tích từng phương án (Per-Option Rationale)</span>
                </h3>
                <div className="space-y-3">
                  {question.optionExplanations.map((oe) => {
                    const isOptCorrect = gradeResult.correctOptionIds.includes(oe.optionId);
                    return (
                      <div
                        key={oe.optionId}
                        className={`p-3 rounded-lg border ${
                          isOptCorrect
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="font-mono text-xs font-bold mb-1 flex items-center gap-2">
                          <span
                            className={
                              isOptCorrect
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            Phương án {oe.optionId.toUpperCase()}{' '}
                            {isOptCorrect ? '(Đáp án đúng)' : '(Phương án nhiễu)'}
                          </span>
                        </div>
                        <BlockRenderer blocks={oe.content} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
