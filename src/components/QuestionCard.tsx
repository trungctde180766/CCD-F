import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Globe,
  HelpCircle,
  Info,
  Lightbulb,
  MessageSquarePlus,
  RotateCcw,
  Sparkles,
  Tag,
  XCircle,
} from 'lucide-react';
import type { Question, StudyMode } from '../types';
import { gradeQuestion } from '../lib/scoring';
import {
  getCompletePerOptionRationales,
  getExamSmartHint,
  getVietnameseExplanation,
  getVietnameseOptionTranslation,
  getVietnamesePromptSummary,
  LanguageDisplayMode,
  loadLanguageDisplayMode,
  saveLanguageDisplayMode,
} from '../lib/bilingualAndRationale';
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
 * Core Question Card component with:
 * - Bilingual EN / EN+VI / VI support (including during Mock Exam)
 * - Smart Exam Assistant Toolkit (Hint, Option Elimination Strikethrough, Optional Instant Check in Exam)
 * - Complete Per-Option Rationales ("Vì sao câu này đúng / Vì sao câu này sai") for all 110 questions
 * - Strict anti-spoiler DOM guarantee before checking/revealing
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
  const [langMode, setLangMode] = useState<LanguageDisplayMode>(() =>
    loadLanguageDisplayMode()
  );
  const [showSmartHint, setShowSmartHint] = useState<boolean>(false);
  const [eliminatedOptionIds, setEliminatedOptionIds] = useState<Record<string, boolean>>({});
  const [examInstantPeek, setExamInstantPeek] = useState<boolean>(false);

  const [isNoteOpen, setIsNoteOpen] = useState<boolean>(Boolean(noteText.trim()));
  const [draftNote, setDraftNote] = useState<string>(noteText);
  const [noteSavedToast, setNoteSavedToast] = useState<boolean>(false);

  // Reset per-question transient assistant state when question changes
  useEffect(() => {
    setDraftNote(noteText);
    setIsNoteOpen(Boolean(noteText.trim()));
    setNoteSavedToast(false);
    setShowSmartHint(false);
    setEliminatedOptionIds({});
    setExamInstantPeek(false);
  }, [question.id, noteText]);

  const handleChangeLangMode = (nextMode: LanguageDisplayMode) => {
    setLangMode(nextMode);
    saveLanguageDisplayMode(nextMode);
  };

  const toggleEliminateOption = (optId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEliminatedOptionIds((prev) => ({
      ...prev,
      [optId]: !prev[optId],
    }));
  };

  const isMultiple = question.interaction.type === 'multiple_choice';

  // Effective reveal status: either formally submitted/revealed OR user clicked "Trợ giúp xem giải ngay trong lúc thi"
  const effectiveRevealed = isSubmittedOrRevealed || examInstantPeek;

  // Only compute grading details and rationales when effectiveRevealed is true!
  const gradeResult = effectiveRevealed
    ? gradeQuestion(question, selectedOptionIds)
    : null;

  const perOptionRationales = useMemo(() => {
    if (!effectiveRevealed) return [];
    return getCompletePerOptionRationales(question);
  }, [effectiveRevealed, question]);

  const perOptionRationaleMap = useMemo(() => {
    return new Map(perOptionRationales.map((r) => [r.optionId, r]));
  }, [perOptionRationales]);

  const smartHint = useMemo(() => getExamSmartHint(question), [question]);
  const viPromptSummary = useMemo(() => getVietnamesePromptSummary(question), [question]);

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

  const showEnglish = langMode === 'en' || langMode === 'bilingual';
  const showVietnamese = langMode === 'vi' || langMode === 'bilingual';

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

        {/* Right Controls: Language Switcher (EN / Song ngữ / VI) + Exam Assistant + Bookmark + Note */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Bilingual Switcher — Available in Study, Practice, AND Exam modes! */}
          <div
            className="inline-flex items-center rounded-lg p-0.5 bg-slate-200/80 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 text-xs"
            role="group"
            aria-label="Chế độ ngôn ngữ hiển thị"
          >
            <Globe className="w-3.5 h-3.5 ml-1.5 mr-1 text-brand-600 dark:text-brand-400 shrink-0" />
            <button
              type="button"
              onClick={() => handleChangeLangMode('en')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                langMode === 'en'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Chỉ hiển thị tiếng Anh gốc"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => handleChangeLangMode('bilingual')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                langMode === 'bilingual'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Song ngữ Anh – Việt (Hỗ trợ dịch ngay trong lúc thi & học)"
            >
              Song ngữ EN+VI
            </button>
            <button
              type="button"
              onClick={() => handleChangeLangMode('vi')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                langMode === 'vi'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Ưu tiên hiển thị bản dịch tiếng Việt"
            >
              VI
            </button>
          </div>

          {/* Smart Hint Button (Works in Exam, Practice & Study) */}
          <button
            type="button"
            onClick={() => setShowSmartHint((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              showSmartHint
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
            title="Gợi ý hướng tư duy & từ khóa trọng tâm cho câu hỏi này"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Gợi ý</span>
          </button>

          {mode === 'exam' && onToggleExamFlag && (
            <button
              type="button"
              onClick={onToggleExamFlag}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isFlaggedForExam
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              aria-pressed={isFlaggedForExam}
            >
              <Flag className={`w-3.5 h-3.5 ${isFlaggedForExam ? 'fill-current' : ''}`} />
              <span>{isFlaggedForExam ? 'Đã gắn cờ' : 'Đánh dấu xem lại'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleBookmark}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
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

      {/* Question Prompt & Options */}
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

        {/* Smart Exam Hint Drawer (Non-spoiler guidance) */}
        {showSmartHint && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs sm:text-sm text-amber-950 dark:text-amber-100 space-y-2">
            <div className="font-bold flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Gợi ý tư duy & Từ khóa trọng tâm (Hỗ trợ làm bài)</span>
              </span>
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Mảng: {smartHint.topicFocusVi}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold">Từ khóa mấu chốt:</span>
              {smartHint.keyClues.map((clue, i) => (
                <code
                  key={i}
                  className="px-2 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/70 font-mono text-xs font-semibold"
                >
                  {clue}
                </code>
              ))}
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-amber-900 dark:text-amber-200">
              <strong>Nguyên tắc gợi mở:</strong> {smartHint.guidingPrincipleVi}
            </p>
          </div>
        )}

        {/* English Prompt */}
        {showEnglish && (
          <div className="mb-4">
            <BlockRenderer blocks={question.prompt} />
          </div>
        )}

        {/* Vietnamese Prompt Support (Works in Study, Practice, AND Mock Exam!) */}
        {showVietnamese && (
          <div className="mb-6 p-3.5 sm:p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 text-slate-800 dark:text-slate-200">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Bản dịch hỗ trợ đọc hiểu đề bài (Tiếng Việt)</span>
            </div>
            <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line break-words">
              {viPromptSummary}
            </p>
          </div>
        )}

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
            const isEliminated = Boolean(eliminatedOptionIds[option.id]);
            const inputId = `opt-${question.id}-${option.id}`;

            // Anti-spoiler styling: only compute correct/wrong styles after submission/reveal
            let containerStyle =
              'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700';
            let badgeText: string | null = null;
            let badgeStyle = '';

            if (!effectiveRevealed) {
              if (isSelected) {
                containerStyle =
                  'border-brand-500 dark:border-brand-500 bg-brand-50/60 dark:bg-brand-950/30 ring-1 ring-brand-500';
              } else if (isEliminated) {
                containerStyle =
                  'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 opacity-50';
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
                  'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-90';
                badgeText = 'Phương án nhiễu (Sai)';
                badgeStyle = 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
              }
            }

            const optionRationale = effectiveRevealed
              ? perOptionRationaleMap.get(option.id)
              : undefined;
            const viOptionText = showVietnamese
              ? getVietnameseOptionTranslation(option, question.id)
              : '';

            return (
              <div
                key={option.id}
                className={`rounded-xl border transition-all ${containerStyle}`}
              >
                <div className="flex items-start justify-between gap-2 p-3.5 sm:p-4">
                  <label
                    htmlFor={inputId}
                    className={`flex items-start gap-3.5 flex-1 min-w-0 ${
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

                        {effectiveRevealed && badgeText && (
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

                      {showEnglish && (
                        <div
                          className={`text-[15px] sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed break-words ${
                            !effectiveRevealed && isEliminated ? 'line-through' : ''
                          }`}
                        >
                          {option.label}
                        </div>
                      )}

                      {showVietnamese && (
                        <div
                          className={`mt-1.5 text-xs sm:text-sm text-indigo-900/90 dark:text-indigo-200/90 bg-indigo-50/50 dark:bg-indigo-950/30 px-2.5 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 leading-relaxed break-words ${
                            !effectiveRevealed && isEliminated ? 'line-through' : ''
                          }`}
                        >
                          <span className="font-semibold text-indigo-700 dark:text-indigo-300 mr-1">
                            [VI]
                          </span>
                          {viOptionText}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Option Elimination Button during Exam / Study before checking */}
                  {!effectiveRevealed && !isLocked && (
                    <button
                      type="button"
                      onClick={(e) => toggleEliminateOption(option.id, e)}
                      title={
                        isEliminated
                          ? 'Bỏ gạch ngang phương án này'
                          : 'Loại trừ / gạch mờ phương án nhiễu này'
                      }
                      className={`p-1.5 rounded-lg text-xs font-medium border shrink-0 transition-colors ${
                        isEliminated
                          ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Per-option explanation ("Vì sao ĐÚNG / Vì sao SAI") rendered for EVERY option when revealed! */}
                {effectiveRevealed && optionRationale && (
                  <div
                    className={`mx-3.5 sm:mx-4 mb-3.5 p-3 rounded-lg border text-xs sm:text-sm space-y-1.5 ${
                      optionRationale.isCorrect
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                        : 'bg-white/95 dark:bg-slate-950/70 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      {optionRationale.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <span>
                        {optionRationale.isCorrect
                          ? `Vì sao phương án ${option.id.toUpperCase()} ĐÚNG:`
                          : `Vì sao phương án ${option.id.toUpperCase()} SAI (${optionRationale.flawCategoryVi}):`}
                      </span>
                    </div>

                    {showEnglish && (
                      <div className="text-slate-700 dark:text-slate-300">
                        {optionRationale.sourceBlocks ? (
                          <BlockRenderer blocks={optionRationale.sourceBlocks} />
                        ) : (
                          <p>{optionRationale.englishReason}</p>
                        )}
                      </div>
                    )}

                    {showVietnamese && (
                      <p className="text-indigo-950 dark:text-indigo-200 font-medium pt-0.5">
                        🇻🇳 {optionRationale.vietnameseReason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </fieldset>

        {/* Action Buttons Bar (Check / Reveal / Exam Instant Help / Retry / Prev / Next) */}
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

            {/* Helpful Assistant Button during Mock Exam: Let learner peek at explanation for current question if they want instant help! */}
            {mode === 'exam' && !isSubmittedOrRevealed && (
              <button
                type="button"
                onClick={() => setExamInstantPeek((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                  examInstantPeek
                    ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
                title="Hỗ trợ trong lúc thi: Xem đáp án & giải thích vì sao đúng/sai ngay cho câu hỏi này"
              >
                <Eye className="w-4 h-4" />
                <span>
                  {examInstantPeek
                    ? 'Ẩn trợ giải thích câu này'
                    : 'Trợ giúp thi: Xem đáp án & giải thích câu này'}
                </span>
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

        {/* Graded Result & Full Explanation Panel — ONLY mounted in DOM when effectiveRevealed is true */}
        {effectiveRevealed && gradeResult && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5"
          >
            {/* Status Banner */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                revealedBeforeCheck || examInstantPeek
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                  : gradeResult.isCorrect
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                  : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {revealedBeforeCheck || examInstantPeek ? (
                  <Eye className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : gradeResult.isCorrect ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-base">
                    {examInstantPeek
                      ? 'Đang xem Trợ giúp Giải thích trong lúc thi'
                      : revealedBeforeCheck
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
                  <span>Ghi chú câu hỏi:</span>
                </div>
                {question.sourceNotes.map((note, idx) => (
                  <p key={idx}>{note}</p>
                ))}
              </div>
            )}

            {/* Main Explanation (English + Vietnamese Bilingual Summary) */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-500" />
                  <span>Giải thích chi tiết (Explanation)</span>
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Bộ câu hỏi luyện tập CCDV-F
                </span>
              </div>

              {showEnglish && <BlockRenderer blocks={question.explanation} />}

              {showVietnamese && (
                <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-xs sm:text-sm text-indigo-950 dark:text-indigo-100 space-y-1">
                  <div className="font-bold text-indigo-800 dark:text-indigo-300">
                    🇻🇳 Giải thích đầy đủ bằng Tiếng Việt:
                  </div>
                  <p className="leading-relaxed whitespace-pre-line">
                    {getVietnameseExplanation(question)}
                  </p>
                </div>
              )}
            </div>

            {/* Complete Per-Option Analysis ("Vì sao câu này đúng / Vì sao câu này sai") for ALL 110 questions */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-brand-500" />
                <span>
                  Giải thích chi tiết Vì sao Đúng / Vì sao Sai cho từng phương án (A, B, C, D...)
                </span>
              </h3>
              <div className="space-y-3">
                {perOptionRationales.map((rat) => (
                  <div
                    key={rat.optionId}
                    className={`p-3.5 rounded-xl border ${
                      rat.isCorrect
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={
                          rat.isCorrect
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }
                      >
                        Phương án {rat.optionId.toUpperCase()} —{' '}
                        {rat.isCorrect ? '✓ ĐÁP ÁN ĐÚNG' : `✗ PHƯƠNG ÁN SAI (${rat.flawCategoryVi})`}
                      </span>
                    </div>

                    {showEnglish && (
                      <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mb-1.5">
                        {rat.sourceBlocks ? (
                          <BlockRenderer blocks={rat.sourceBlocks} />
                        ) : (
                          <p>{rat.englishReason}</p>
                        )}
                      </div>
                    )}

                    {showVietnamese && (
                      <p className="text-xs sm:text-sm text-indigo-950 dark:text-indigo-200 font-medium">
                        🇻🇳 {rat.vietnameseReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
